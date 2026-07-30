export type Theme = 'light' | 'dark' | 'oled' | 'sepia'
export const THEMES: Theme[] = ['light', 'dark', 'oled', 'sepia']
const STORAGE_KEY = 'schloss-theme'
const UPDATED_AT_KEY = 'schloss-theme-updated-at'

/** Fired on `window` every time `applyTheme` runs, so something outside
 * the call site (e.g. `ThemeSync`, cross-origin sync) can react without
 * polling. */
export const THEME_CHANGE_EVENT = 'schloss:theme-change'

export interface ThemeChangeDetail {
  theme: Theme
  updatedAt: number
}

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  if (stored && THEMES.includes(stored)) return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** When this origin's stored theme was last actually set by `applyTheme`
 * (a local `ThemeToggle` selection, or an incoming cross-origin sync) - 0
 * if never set here. Lets last-write-wins conflict resolution (see
 * `ThemeSync`) compare "how fresh is what's on THIS origin" against what
 * another origin reports, without a shared clock/server - just whichever
 * origin's own `applyTheme` call happened most recently by wall-clock
 * time. */
export function getThemeUpdatedAt(): number {
  const stored = localStorage.getItem(UPDATED_AT_KEY)
  const parsed = stored ? Number(stored) : 0
  return Number.isFinite(parsed) ? parsed : 0
}

// `updatedAt` is deliberately NOT defaulted to `Date.now()` - every app
// calls `applyTheme(getStoredTheme())` on every page load just to
// (re)reflect the already-stored preference onto the document, not to
// declare a new one. Defaulting to "now" there would make every mere
// reload look like a fresh preference change, breaking the last-write-wins
// comparison `ThemeSync` relies on. This isn't just "every reload" either -
// the first-ever load of an origin that has never stored a theme before is
// the same case: `getThemeUpdatedAt()` is 0 there too, and stamping
// `Date.now()` for what's actually just the system-default theme (not a
// real choice) made a freshly-opened app permanently outrank a real
// selection made moments earlier on another origin (confirmed live: pick a
// theme on schloss, then open kuvert for the first time - kuvert's own
// bootstrap call would mint a "newer" timestamp for its default theme and
// push that OVER the real pick instead of adopting it). So: always reuse
// whatever's already stored (0 if nothing ever was) unless the caller
// explicitly passes a real new timestamp - `ThemeToggle`'s own selection
// does, since that's the one place an actual user choice happens; so does
// `ThemeSync` when adopting a value it received from the hub.
export function applyTheme(theme: Theme, updatedAt: number = getThemeUpdatedAt()) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(STORAGE_KEY, theme)
  localStorage.setItem(UPDATED_AT_KEY, String(updatedAt))
  window.dispatchEvent(
    new CustomEvent<ThemeChangeDetail>(THEME_CHANGE_EVENT, { detail: { theme, updatedAt } }),
  )
}
