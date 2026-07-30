import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  THEMES,
  applyTheme,
  getStoredTheme,
  getThemeUpdatedAt,
  THEME_CHANGE_EVENT,
} from './theme'

const STORAGE_KEY = 'schloss-theme'
const UPDATED_AT_KEY = 'schloss-theme-updated-at'

// Helper to set up matchMedia mock with a configurable `matches` result.
function mockMatchMedia(darkMode: boolean) {
  window.matchMedia = (query: string) => ({
    matches: darkMode && query === '(prefers-color-scheme: dark)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList
}

beforeEach(() => {
  localStorage.clear()
  mockMatchMedia(false)
  // Reset data-theme attribute
  document.documentElement.removeAttribute('data-theme')
})

// ---------------------------------------------------------------------------
// THEMES constant
// ---------------------------------------------------------------------------
describe('THEMES', () => {
  it('contains exactly 4 themes', () => {
    expect(THEMES).toHaveLength(4)
  })

  it('contains themes in the correct order: light, dark, oled, sepia', () => {
    expect(THEMES).toEqual(['light', 'dark', 'oled', 'sepia'])
  })
})

// ---------------------------------------------------------------------------
// applyTheme
// ---------------------------------------------------------------------------
describe('applyTheme', () => {
  it('sets data-theme attribute on documentElement', () => {
    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('sets data-theme to the given theme value', () => {
    applyTheme('oled')
    expect(document.documentElement.getAttribute('data-theme')).toBe('oled')
  })

  it('saves the theme to localStorage under "schloss-theme"', () => {
    applyTheme('sepia')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('sepia')
  })

  it('updates localStorage when called again with a different theme', () => {
    applyTheme('light')
    applyTheme('dark')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})

// ---------------------------------------------------------------------------
// getStoredTheme
// ---------------------------------------------------------------------------
describe('getStoredTheme', () => {
  it('returns the stored theme when it is valid', () => {
    localStorage.setItem(STORAGE_KEY, 'oled')
    expect(getStoredTheme()).toBe('oled')
  })

  it('returns "sepia" when "sepia" is stored', () => {
    localStorage.setItem(STORAGE_KEY, 'sepia')
    expect(getStoredTheme()).toBe('sepia')
  })

  it('falls back to "light" when no value is stored and system is light', () => {
    mockMatchMedia(false)
    expect(getStoredTheme()).toBe('light')
  })

  it('falls back to "dark" when no value is stored and system prefers dark', () => {
    mockMatchMedia(true)
    expect(getStoredTheme()).toBe('dark')
  })

  it('ignores an invalid stored value and falls back to system preference (light)', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid-theme')
    mockMatchMedia(false)
    expect(getStoredTheme()).toBe('light')
  })

  it('ignores an invalid stored value and falls back to system preference (dark)', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid-theme')
    mockMatchMedia(true)
    expect(getStoredTheme()).toBe('dark')
  })
})

// ---------------------------------------------------------------------------
// getThemeUpdatedAt
// ---------------------------------------------------------------------------
describe('getThemeUpdatedAt', () => {
  it('returns 0 when nothing is stored', () => {
    expect(getThemeUpdatedAt()).toBe(0)
  })

  it('returns 0 when the stored value is not a valid number', () => {
    localStorage.setItem(UPDATED_AT_KEY, 'not-a-number')
    expect(getThemeUpdatedAt()).toBe(0)
  })

  it('returns the stored numeric value when valid', () => {
    localStorage.setItem(UPDATED_AT_KEY, '1700000000000')
    expect(getThemeUpdatedAt()).toBe(1700000000000)
  })
})

// ---------------------------------------------------------------------------
// applyTheme - timestamp handling
// ---------------------------------------------------------------------------
describe('applyTheme (timestamp handling)', () => {
  it('stores the explicitly passed updatedAt value', () => {
    applyTheme('dark', 12345)
    expect(getThemeUpdatedAt()).toBe(12345)
  })

  it('stores an explicitly passed updatedAt of 0 (not treated as "omitted")', () => {
    applyTheme('dark', 0)
    expect(localStorage.getItem(UPDATED_AT_KEY)).toBe('0')
    expect(getThemeUpdatedAt()).toBe(0)
  })

  it('overwrites a previously stored updatedAt when a new explicit value is passed', () => {
    applyTheme('dark', 111)
    applyTheme('light', 222)
    expect(getThemeUpdatedAt()).toBe(222)
  })

  it('stores 0 (not a fresh Date.now()) when updatedAt is omitted and none is stored yet', () => {
    // A first-ever call with no explicit updatedAt is just reflecting the
    // system-default theme, not declaring a real preference - stamping
    // "now" here would make a freshly-opened origin permanently outrank a
    // real selection made moments earlier elsewhere (the actual bug this
    // guards against: pick a theme on one origin, then open another
    // origin for the first time - its own bootstrap call must not mint a
    // "newer" timestamp for the default theme and push that over the real
    // pick).
    applyTheme('dark')
    expect(getThemeUpdatedAt()).toBe(0)
  })

  it('preserves an existing stored updatedAt when called again without one (e.g. applyTheme(getStoredTheme()) on reload)', () => {
    applyTheme('dark', 5000)
    expect(getThemeUpdatedAt()).toBe(5000)

    // Simulate a later page load re-applying the already-known theme with the
    // single-argument form - this must NOT bump the timestamp to "now".
    applyTheme('dark')
    expect(getThemeUpdatedAt()).toBe(5000)

    applyTheme(getStoredTheme())
    expect(getThemeUpdatedAt()).toBe(5000)
  })

  it('preserves the existing stored updatedAt even when the theme itself changes', () => {
    applyTheme('light', 7777)
    applyTheme('dark')
    expect(getThemeUpdatedAt()).toBe(7777)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})

// ---------------------------------------------------------------------------
// applyTheme - THEME_CHANGE_EVENT dispatch
// ---------------------------------------------------------------------------
describe('applyTheme (THEME_CHANGE_EVENT dispatch)', () => {
  it('dispatches THEME_CHANGE_EVENT on window with the applied theme and the explicit updatedAt', () => {
    const handler = vi.fn()
    window.addEventListener(THEME_CHANGE_EVENT, handler)

    applyTheme('oled', 999)

    expect(handler).toHaveBeenCalledTimes(1)
    const event = handler.mock.calls[0][0] as CustomEvent
    expect(event.detail).toEqual({ theme: 'oled', updatedAt: 999 })

    window.removeEventListener(THEME_CHANGE_EVENT, handler)
  })

  it('dispatches THEME_CHANGE_EVENT with the preserved existing updatedAt when none is passed', () => {
    applyTheme('light', 4242)

    const handler = vi.fn()
    window.addEventListener(THEME_CHANGE_EVENT, handler)

    applyTheme('dark')

    expect(handler).toHaveBeenCalledTimes(1)
    const event = handler.mock.calls[0][0] as CustomEvent
    expect(event.detail).toEqual({ theme: 'dark', updatedAt: 4242 })

    window.removeEventListener(THEME_CHANGE_EVENT, handler)
  })

  it('dispatches THEME_CHANGE_EVENT with updatedAt 0 (not a fresh stamp) on a first-ever call', () => {
    const handler = vi.fn()
    window.addEventListener(THEME_CHANGE_EVENT, handler)

    applyTheme('sepia')

    expect(handler).toHaveBeenCalledTimes(1)
    const event = handler.mock.calls[0][0] as CustomEvent
    expect(event.detail).toEqual({ theme: 'sepia', updatedAt: 0 })
    expect(getThemeUpdatedAt()).toBe(0)

    window.removeEventListener(THEME_CHANGE_EVENT, handler)
  })
})
