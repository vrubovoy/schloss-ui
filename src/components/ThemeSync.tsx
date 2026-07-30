import { useEffect } from 'react'
import {
  type Theme, THEMES, THEME_CHANGE_EVENT, type ThemeChangeDetail,
  applyTheme, getStoredTheme, getThemeUpdatedAt,
} from '../lib/theme'

const THEME_PATH = '/theme'

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as string[]).includes(value)
}

interface ThemeResponse {
  theme: Theme | null
  updatedAt: number
}

export interface ThemeSyncProps {
  /** Origin hosting schlussel's shared `/theme` API (it's already the
   * platform's account/identity authority, so it doubles as the shared
   * store for this one small preference too), e.g.
   * `"https://auth.example.com"`. No trailing slash, no path. */
  apiOrigin: string
}

function push(apiOrigin: string, theme: Theme, updatedAt: number) {
  // `keepalive` lets this survive the page unloading right after a theme
  // change (e.g. the visitor immediately navigates to another app) - a
  // plain fetch would otherwise risk being aborted mid-flight and the
  // pushed value never actually reaching the API.
  void fetch(`${apiOrigin}${THEME_PATH}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme, updatedAt }),
    keepalive: true,
  }).catch(() => {})
}

// The platform's three apps each live on their own subdomain (separate
// origins), so localStorage can't be shared between them directly (see
// theme.ts) - this keeps the light/dark/etc. theme preference in sync
// across all of them anyway, via a plain cross-origin fetch to schlussel's
// shared `/theme` API (CORS-enabled there).
//
// An earlier version of this did the same thing through a hidden iframe +
// postMessage + the iframe's own localStorage, reasoning that a shared
// origin's storage would sync across embeds. It doesn't: Firefox's Total
// Cookie Protection (and Safari's ITP) partitions localStorage - and
// BroadcastChannel - inside a third-party iframe by whichever site embeds
// it, so the exact same hub page embedded in two different apps saw two
// completely separate storage buckets and never actually synced anything.
// A plain fetch response isn't subject to that at all, since it doesn't
// touch any client-side storage belonging to the target origin.
export function ThemeSync({ apiOrigin }: ThemeSyncProps) {
  useEffect(() => {
    let cancelled = false

    fetch(`${apiOrigin}${THEME_PATH}`)
      .then((res) => (res.ok ? (res.json() as Promise<ThemeResponse>) : null))
      .then((data) => {
        if (cancelled || !data) return
        const localUpdatedAt = getThemeUpdatedAt()
        if (isTheme(data.theme) && data.updatedAt > localUpdatedAt) {
          applyTheme(data.theme, data.updatedAt)
        } else if (localUpdatedAt > data.updatedAt) {
          // This origin's own value is newer than what the API has (e.g.
          // it's never heard from this app before) - push it so the next
          // origin to ask picks it up.
          push(apiOrigin, getStoredTheme(), localUpdatedAt)
        }
      })
      .catch(() => {})

    function onLocalThemeChange(event: Event) {
      const { theme, updatedAt } = (event as CustomEvent<ThemeChangeDetail>).detail
      push(apiOrigin, theme, updatedAt)
    }

    window.addEventListener(THEME_CHANGE_EVENT, onLocalThemeChange)
    return () => {
      cancelled = true
      window.removeEventListener(THEME_CHANGE_EVENT, onLocalThemeChange)
    }
  }, [apiOrigin])

  return null
}
