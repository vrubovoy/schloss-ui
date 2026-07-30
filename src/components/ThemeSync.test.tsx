import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { ThemeSync } from './ThemeSync'
import {
  applyTheme,
  getStoredTheme,
  getThemeUpdatedAt,
  THEME_CHANGE_EVENT,
} from '../lib/theme'

const HUB_ORIGIN = 'https://hub.example.com'
const THEME_KEY = 'schloss-theme'
const UPDATED_AT_KEY = 'schloss-theme-updated-at'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** Renders <ThemeSync>, returns the rendered iframe element. */
function renderThemeSync() {
  const { container, unmount } = render(<ThemeSync hubOrigin={HUB_ORIGIN} />)
  const iframe = container.querySelector('iframe')
  if (!iframe) throw new Error('ThemeSync did not render an <iframe>')
  return { container, iframe, unmount }
}

/** Fires the iframe's `load` event, as jsdom won't do this on its own for a
 * `src` it can't actually resolve. */
function fireIframeLoad(iframe: HTMLIFrameElement) {
  fireEvent(iframe, new Event('load'))
}

describe('ThemeSync (rendering)', () => {
  it('renders a hidden iframe pointed at `${hubOrigin}/theme-sync.html`', () => {
    const { iframe } = renderThemeSync()

    expect(iframe.src).toBe(`${HUB_ORIGIN}/theme-sync.html`)
    expect(iframe.getAttribute('aria-hidden')).toBe('true')
  })

  it('the iframe has a `contentWindow` available in jsdom, even without a real cross-origin navigation', () => {
    const { iframe } = renderThemeSync()
    expect(iframe.contentWindow).not.toBeNull()
  })
})

describe('ThemeSync (hello handshake on iframe load)', () => {
  it('posts a schloss-theme-sync:hello message to the iframe, targeted at hubOrigin, once it loads', () => {
    const { iframe } = renderThemeSync()
    const postMessageSpy = vi.spyOn(iframe.contentWindow as Window, 'postMessage')

    fireIframeLoad(iframe)

    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: 'schloss-theme-sync:hello' },
      HUB_ORIGIN,
    )
  })

  it('does not post the hello message before the iframe has fired its load event', () => {
    const { iframe } = renderThemeSync()
    const postMessageSpy = vi.spyOn(iframe.contentWindow as Window, 'postMessage')

    expect(postMessageSpy).not.toHaveBeenCalled()
  })
})

describe('ThemeSync (receiving a value message from the hub)', () => {
  it('adopts the hub theme via applyTheme(theme, updatedAt) when the hub value is newer than the local one', () => {
    const { iframe } = renderThemeSync()
    fireIframeLoad(iframe)

    localStorage.setItem(THEME_KEY, 'light')
    localStorage.setItem(UPDATED_AT_KEY, '1000')

    fireEvent(
      window,
      new MessageEvent('message', {
        origin: HUB_ORIGIN,
        data: { type: 'schloss-theme-sync:value', theme: 'dark', updatedAt: 2000 },
      }),
    )

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(getStoredTheme()).toBe('dark')
    expect(getThemeUpdatedAt()).toBe(2000)
  })

  it('posts a push message back to the hub when the local value is newer than the hub one', () => {
    const { iframe } = renderThemeSync()
    fireIframeLoad(iframe)
    const postMessageSpy = vi.spyOn(iframe.contentWindow as Window, 'postMessage')

    localStorage.setItem(THEME_KEY, 'sepia')
    localStorage.setItem(UPDATED_AT_KEY, '5000')

    fireEvent(
      window,
      new MessageEvent('message', {
        origin: HUB_ORIGIN,
        data: { type: 'schloss-theme-sync:value', theme: 'light', updatedAt: 1000 },
      }),
    )

    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: 'schloss-theme-sync:push', theme: 'sepia', updatedAt: 5000 },
      HUB_ORIGIN,
    )
    // and it must not have adopted the (older/stale) hub value
    expect(document.documentElement.getAttribute('data-theme')).not.toBe('light')
  })

  it('does nothing when the timestamps are equal', () => {
    const { iframe } = renderThemeSync()
    fireIframeLoad(iframe)

    localStorage.setItem(THEME_KEY, 'oled')
    localStorage.setItem(UPDATED_AT_KEY, '3000')

    const postMessageSpy = vi.spyOn(iframe.contentWindow as Window, 'postMessage')

    fireEvent(
      window,
      new MessageEvent('message', {
        origin: HUB_ORIGIN,
        data: { type: 'schloss-theme-sync:value', theme: 'dark', updatedAt: 3000 },
      }),
    )

    expect(document.documentElement.getAttribute('data-theme')).not.toBe('dark')
    expect(getStoredTheme()).toBe('oled')
    expect(postMessageSpy).not.toHaveBeenCalled()
  })

  it('does nothing when the hub theme is null/invalid, even if updatedAt is newer', () => {
    const { iframe } = renderThemeSync()
    fireIframeLoad(iframe)

    localStorage.setItem(THEME_KEY, 'oled')
    localStorage.setItem(UPDATED_AT_KEY, '1000')

    const postMessageSpy = vi.spyOn(iframe.contentWindow as Window, 'postMessage')

    fireEvent(
      window,
      new MessageEvent('message', {
        origin: HUB_ORIGIN,
        data: { type: 'schloss-theme-sync:value', theme: null, updatedAt: 9999 },
      }),
    )

    expect(document.documentElement.getAttribute('data-theme')).not.toBe('9999')
    expect(getStoredTheme()).toBe('oled')
    expect(getThemeUpdatedAt()).toBe(1000)
    expect(postMessageSpy).not.toHaveBeenCalled()
  })
})

describe('ThemeSync (untrusted origin is ignored)', () => {
  it('ignores a well-formed value message from an origin that does not match hubOrigin', () => {
    const { iframe } = renderThemeSync()
    fireIframeLoad(iframe)

    localStorage.setItem(THEME_KEY, 'light')
    localStorage.setItem(UPDATED_AT_KEY, '1000')

    const postMessageSpy = vi.spyOn(iframe.contentWindow as Window, 'postMessage')

    fireEvent(
      window,
      new MessageEvent('message', {
        origin: 'https://evil.example.com',
        data: { type: 'schloss-theme-sync:value', theme: 'dark', updatedAt: 999999 },
      }),
    )

    expect(document.documentElement.getAttribute('data-theme')).not.toBe('dark')
    expect(getStoredTheme()).toBe('light')
    expect(getThemeUpdatedAt()).toBe(1000)
    expect(postMessageSpy).not.toHaveBeenCalled()
  })
})

describe('ThemeSync (pushing local THEME_CHANGE_EVENT changes to the hub)', () => {
  it('pushes the new theme/updatedAt to the hub when THEME_CHANGE_EVENT fires after the iframe has loaded', () => {
    const { iframe } = renderThemeSync()
    fireIframeLoad(iframe)
    const postMessageSpy = vi.spyOn(iframe.contentWindow as Window, 'postMessage')

    applyTheme('dark', 8080)

    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: 'schloss-theme-sync:push', theme: 'dark', updatedAt: 8080 },
      HUB_ORIGIN,
    )
  })

  it('does not push when THEME_CHANGE_EVENT fires before the iframe has fired its load event', () => {
    const { iframe } = renderThemeSync()
    const postMessageSpy = vi.spyOn(iframe.contentWindow as Window, 'postMessage')

    applyTheme('sepia', 4040)

    expect(postMessageSpy).not.toHaveBeenCalled()
  })
})

describe('ThemeSync (unmount cleanup)', () => {
  it('removes its window listeners on unmount so events fired afterwards have no effect and do not throw', () => {
    const { iframe, unmount } = renderThemeSync()
    fireIframeLoad(iframe)

    unmount()

    localStorage.setItem(THEME_KEY, 'light')
    localStorage.setItem(UPDATED_AT_KEY, '1000')

    expect(() => {
      fireEvent(
        window,
        new MessageEvent('message', {
          origin: HUB_ORIGIN,
          data: { type: 'schloss-theme-sync:value', theme: 'dark', updatedAt: 2000 },
        }),
      )
      window.dispatchEvent(
        new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme: 'dark', updatedAt: 2000 } }),
      )
    }).not.toThrow()

    // The unmounted instance's listener must not have applied the hub value.
    expect(document.documentElement.getAttribute('data-theme')).not.toBe('dark')
    expect(getStoredTheme()).toBe('light')
  })
})
