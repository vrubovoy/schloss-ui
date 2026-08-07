import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { ThemeSync } from './ThemeSync'
import { applyTheme, getStoredTheme, getThemeUpdatedAt } from '../lib/theme'

const API_ORIGIN = 'https://hub.example.test'
const THEME_URL = `${API_ORIGIN}/theme`

const STORAGE_KEY = 'schloss-theme'
const UPDATED_AT_KEY = 'schloss-theme-updated-at'

function jsonResponse(ok: boolean, body: unknown): Response {
  return { ok, json: () => Promise.resolve(body) } as Response
}

function flush() {
  return act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  fetchMock = vi.fn()
  // Base fallback for any fetch call beyond the ones a test explicitly
  // queues with mockResolvedValueOnce/mockImplementationOnce (e.g. the PUT
  // requests triggered by THEME_CHANGE_EVENT or by adopting a server
  // theme) - keeps every call promise-returning so `push`'s internal
  // `.catch()` always has a real promise to attach to.
  fetchMock.mockResolvedValue(jsonResponse(true, { theme: null, updatedAt: 0 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ThemeSync (rendering)', () => {
  it('renders nothing visible', () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(true, { theme: null, updatedAt: 0 }))
    const { container } = render(<ThemeSync apiOrigin={API_ORIGIN} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('ThemeSync (initial GET)', () => {
  it('calls fetch on mount with a plain GET to `${apiOrigin}/theme` (no special headers/options)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(true, { theme: null, updatedAt: 0 }))
    render(<ThemeSync apiOrigin={API_ORIGIN} />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0]).toEqual([THEME_URL])
  })

  it('does nothing when the response is not ok', async () => {
    localStorage.setItem(STORAGE_KEY, 'light')
    localStorage.setItem(UPDATED_AT_KEY, '10')
    fetchMock.mockResolvedValueOnce(jsonResponse(false, { theme: 'dark', updatedAt: 999999999999 }))

    render(<ThemeSync apiOrigin={API_ORIGIN} />)
    await flush()

    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    expect(getStoredTheme()).toBe('light')
    expect(getThemeUpdatedAt()).toBe(10)
    expect(fetchMock).toHaveBeenCalledTimes(1) // GET only, no PUT
  })

  it('does not throw and does nothing when fetch itself rejects (network error)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))

    expect(() => render(<ThemeSync apiOrigin={API_ORIGIN} />)).not.toThrow()
    await flush()

    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the parsed response body is null', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(true, null))

    render(<ThemeSync apiOrigin={API_ORIGIN} />)
    await flush()

    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not throw and does nothing when parsing the response body throws', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new Error('bad json')),
    } as Response)

    expect(() => render(<ThemeSync apiOrigin={API_ORIGIN} />)).not.toThrow()
    await flush()

    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('ThemeSync (adopting a newer server theme)', () => {
  it('calls applyTheme with the server theme and its exact updatedAt when the server is newer', async () => {
    localStorage.setItem(STORAGE_KEY, 'light')
    localStorage.setItem(UPDATED_AT_KEY, '100')
    fetchMock.mockResolvedValueOnce(jsonResponse(true, { theme: 'dark', updatedAt: 200 }))

    render(<ThemeSync apiOrigin={API_ORIGIN} />)

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })
    expect(getStoredTheme()).toBe('dark')
    expect(getThemeUpdatedAt()).toBe(200)

    // applyTheme() itself dispatches THEME_CHANGE_EVENT (see theme.ts), and
    // the component's own listener for that event (behavior 4) has no way
    // to distinguish "its own adoption" from any other source - so this
    // adoption is followed by the component echoing the very value it just
    // adopted back to the server as an independent PUT.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(url).toBe(THEME_URL)
    expect(init.method).toBe('PUT')
    expect(init.keepalive).toBe(true)
    expect(JSON.parse(init.body as string)).toEqual({ theme: 'dark', updatedAt: 200 })
  })

  it('ignores an invalid theme value from the server even when its updatedAt is newer, and sends no PUT (local is not newer)', async () => {
    localStorage.setItem(STORAGE_KEY, 'light')
    localStorage.setItem(UPDATED_AT_KEY, '10')
    fetchMock.mockResolvedValueOnce(jsonResponse(true, { theme: 'neon', updatedAt: 999 }))

    render(<ThemeSync apiOrigin={API_ORIGIN} />)
    await flush()

    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    expect(getStoredTheme()).toBe('light')
    expect(getThemeUpdatedAt()).toBe(10)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('ThemeSync (pushing a newer local theme)', () => {
  it('PUTs the current local theme+updatedAt (with keepalive: true) when local is newer than the server', async () => {
    localStorage.setItem(STORAGE_KEY, 'sepia')
    localStorage.setItem(UPDATED_AT_KEY, '500')
    fetchMock.mockResolvedValueOnce(jsonResponse(true, { theme: 'light', updatedAt: 100 }))

    render(<ThemeSync apiOrigin={API_ORIGIN} />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(url).toBe(THEME_URL)
    expect(init.method).toBe('PUT')
    expect(init.keepalive).toBe(true)
    expect(JSON.parse(init.body as string)).toEqual({ theme: 'sepia', updatedAt: 500 })

    // applyTheme was NOT called - the server value must not have been adopted.
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    expect(getStoredTheme()).toBe('sepia')
    expect(getThemeUpdatedAt()).toBe(500)
  })

  it('still PUTs the local theme when the server theme is null, as long as local is newer', async () => {
    localStorage.setItem(STORAGE_KEY, 'dark')
    localStorage.setItem(UPDATED_AT_KEY, '50')
    fetchMock.mockResolvedValueOnce(jsonResponse(true, { theme: null, updatedAt: 10 }))

    render(<ThemeSync apiOrigin={API_ORIGIN} />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(init.method).toBe('PUT')
    expect(init.keepalive).toBe(true)
    expect(JSON.parse(init.body as string)).toEqual({ theme: 'dark', updatedAt: 50 })
  })

  it('adopts a newer winning server value returned by PUT', async () => {
    localStorage.setItem(STORAGE_KEY, 'light')
    localStorage.setItem(UPDATED_AT_KEY, '100')
    fetchMock
      .mockResolvedValueOnce(jsonResponse(true, { theme: null, updatedAt: 0 }))
      .mockResolvedValueOnce(jsonResponse(true, { theme: 'sepia', updatedAt: 200 }))

    render(<ThemeSync apiOrigin={API_ORIGIN} />)

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'sepia')
    })
    expect(getStoredTheme()).toBe('sepia')
    expect(getThemeUpdatedAt()).toBe(200)
  })

  it('does not let a delayed PUT response replace newer local state', async () => {
    localStorage.setItem(STORAGE_KEY, 'light')
    localStorage.setItem(UPDATED_AT_KEY, '100')
    let resolvePut!: (value: Response) => void
    const pendingPut = new Promise<Response>((resolve) => {
      resolvePut = resolve
    })
    fetchMock
      .mockResolvedValueOnce(jsonResponse(true, { theme: null, updatedAt: 0 }))
      .mockImplementationOnce(() => pendingPut)
      .mockResolvedValueOnce(jsonResponse(true, { theme: 'dark', updatedAt: 300 }))

    render(<ThemeSync apiOrigin={API_ORIGIN} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    act(() => {
      applyTheme('dark', 300)
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    resolvePut(jsonResponse(true, { theme: 'sepia', updatedAt: 200 }))
    await flush()

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(getStoredTheme()).toBe('dark')
    expect(getThemeUpdatedAt()).toBe(300)
  })
})

describe('ThemeSync (no-op on equal timestamps)', () => {
  it('does nothing when the local and server updatedAt values are equal', async () => {
    localStorage.setItem(STORAGE_KEY, 'oled')
    localStorage.setItem(UPDATED_AT_KEY, '300')
    fetchMock.mockResolvedValueOnce(jsonResponse(true, { theme: 'light', updatedAt: 300 }))

    render(<ThemeSync apiOrigin={API_ORIGIN} />)
    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(1) // GET only - no applyTheme, no PUT
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    expect(getStoredTheme()).toBe('oled')
    expect(getThemeUpdatedAt()).toBe(300)
  })
})

describe('ThemeSync (THEME_CHANGE_EVENT -> PUT)', () => {
  it('sends a PUT with the event detail (and keepalive: true) whenever THEME_CHANGE_EVENT fires', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(true, { theme: null, updatedAt: 0 }))
    render(<ThemeSync apiOrigin={API_ORIGIN} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    act(() => {
      applyTheme('dark', 12345)
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(url).toBe(THEME_URL)
    expect(init.method).toBe('PUT')
    expect(init.keepalive).toBe(true)
    expect(JSON.parse(init.body as string)).toEqual({ theme: 'dark', updatedAt: 12345 })
  })

  it('sends an independent PUT for each subsequent THEME_CHANGE_EVENT dispatch', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(true, { theme: null, updatedAt: 0 }))
    render(<ThemeSync apiOrigin={API_ORIGIN} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    act(() => {
      applyTheme('dark', 111)
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    act(() => {
      applyTheme('light', 222)
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    const secondPut = fetchMock.mock.calls[1] as [string, RequestInit]
    const thirdPut = fetchMock.mock.calls[2] as [string, RequestInit]
    expect(JSON.parse(secondPut[1].body as string)).toEqual({ theme: 'dark', updatedAt: 111 })
    expect(JSON.parse(thirdPut[1].body as string)).toEqual({ theme: 'light', updatedAt: 222 })
  })

  it('fires its own PUT for THEME_CHANGE_EVENT even before the initial GET has resolved', async () => {
    let resolveGet!: (value: Response) => void
    const pendingGet = new Promise<Response>((resolve) => {
      resolveGet = resolve
    })
    fetchMock.mockImplementationOnce(() => pendingGet)

    render(<ThemeSync apiOrigin={API_ORIGIN} />)

    act(() => {
      applyTheme('sepia', 777)
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(url).toBe(THEME_URL)
    expect(init.method).toBe('PUT')
    expect(init.keepalive).toBe(true)
    expect(JSON.parse(init.body as string)).toEqual({ theme: 'sepia', updatedAt: 777 })

    // Resolve the still-pending GET afterward so it can't leak into other
    // tests or surface as an unhandled rejection.
    resolveGet(jsonResponse(true, { theme: null, updatedAt: 0 }))
    await flush()
  })
})

describe('ThemeSync (unmount cleanup)', () => {
  it('removes its THEME_CHANGE_EVENT listener on unmount, so a later dispatch triggers no further PUT', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(true, { theme: null, updatedAt: 0 }))
    const { unmount } = render(<ThemeSync apiOrigin={API_ORIGIN} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    unmount()

    act(() => {
      applyTheme('dark', 999)
    })
    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
