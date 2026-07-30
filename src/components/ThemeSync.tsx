import { useEffect, useRef } from 'react'
import {
  type Theme, THEMES, THEME_CHANGE_EVENT, type ThemeChangeDetail,
  applyTheme, getStoredTheme, getThemeUpdatedAt,
} from '../lib/theme'

const HUB_PATH = '/theme-sync.html'
const HELLO: HubMessage = { type: 'schloss-theme-sync:hello' }

type HubMessage =
  | { type: 'schloss-theme-sync:hello' }
  | { type: 'schloss-theme-sync:value'; theme: Theme | null; updatedAt: number }
  | { type: 'schloss-theme-sync:push'; theme: Theme; updatedAt: number }

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as string[]).includes(value)
}

export interface ThemeSyncProps {
  /** Origin hosting the shared theme-sync hub page (schlussel - it's
   * already the platform's account/identity authority, so it doubles as
   * the shared store for this one small preference too), e.g.
   * `"https://auth.example.com"`. No trailing slash, no path. */
  hubOrigin: string
}

// The platform's three apps each live on their own subdomain (separate
// origins), so localStorage can't be shared between them directly (see
// theme.ts) - this keeps the light/dark/etc. theme preference in sync
// across all of them anyway. Mounts a hidden iframe pointing at
// schlussel's own `/theme-sync.html` and exchanges postMessage with it:
// on load, ask the hub for its value and adopt it here if it's newer than
// what's stored locally (or push this origin's value to the hub if it's
// the newer one); whenever the theme changes locally afterwards (via
// ThemeToggle, anywhere on the page), push the new value to the hub
// immediately so it's ready the next time another origin asks.
export function ThemeSync({ hubOrigin }: ThemeSyncProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const readyRef = useRef(false)

  useEffect(() => {
    readyRef.current = false

    function post(message: HubMessage) {
      iframeRef.current?.contentWindow?.postMessage(message, hubOrigin)
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== hubOrigin) return
      const data = event.data as HubMessage
      if (data?.type !== 'schloss-theme-sync:value') return

      const localUpdatedAt = getThemeUpdatedAt()
      if (isTheme(data.theme) && data.updatedAt > localUpdatedAt) {
        applyTheme(data.theme, data.updatedAt)
      } else if (localUpdatedAt > data.updatedAt) {
        // This origin's own value is newer than what the hub has (e.g.
        // it's never heard from this app before, or missed an earlier
        // update) - push it so the hub (and the next origin to ask) picks
        // it up.
        post({ type: 'schloss-theme-sync:push', theme: getStoredTheme(), updatedAt: localUpdatedAt })
      }
    }

    function onLoad() {
      readyRef.current = true
      post(HELLO)
    }

    function onLocalThemeChange(event: Event) {
      if (!readyRef.current) return
      const { theme, updatedAt } = (event as CustomEvent<ThemeChangeDetail>).detail
      post({ type: 'schloss-theme-sync:push', theme, updatedAt })
    }

    window.addEventListener('message', onMessage)
    window.addEventListener(THEME_CHANGE_EVENT, onLocalThemeChange)
    const iframe = iframeRef.current
    iframe?.addEventListener('load', onLoad)

    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener(THEME_CHANGE_EVENT, onLocalThemeChange)
      iframe?.removeEventListener('load', onLoad)
    }
  }, [hubOrigin])

  return (
    <iframe
      ref={iframeRef}
      src={`${hubOrigin}${HUB_PATH}`}
      title="theme-sync"
      aria-hidden="true"
      tabIndex={-1}
      style={{ display: 'none' }}
    />
  )
}
