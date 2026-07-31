import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'
import { AuthContext, useAuth, useAuthProvider } from './useAuthProvider'
import type { ApiClient } from './apiClient'
import type { AuthState, AuthUser } from './useAuthProvider'

function jsonResponse(ok: boolean, body: unknown): Response {
  return { ok, json: () => Promise.resolve(body) } as Response
}

function header(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name)
}

function makeApiClient(): ApiClient {
  return {
    setAccessToken: vi.fn(),
    getAccessToken: vi.fn(() => null),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}

const testUser: AuthUser = { id: '1', email: 'a@example.test', name: 'Alice', role: 'user' }

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useAuthProvider - bootstrap', () => {
  it('starts with loading: true and user: null before the refresh call settles', async () => {
    let resolveRefresh!: (value: Response) => void
    const pending = new Promise<Response>((resolve) => {
      resolveRefresh = resolve
    })
    fetchMock.mockImplementationOnce(() => pending)
    const apiClient = makeApiClient()

    const { result } = renderHook(() => useAuthProvider({ apiClient }))

    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBeNull()

    await act(async () => {
      resolveRefresh(jsonResponse(false, {}))
      await Promise.resolve()
      await Promise.resolve()
    })
  })

  it('calls POST `${authBase}/refresh` with credentials: include (default authBase /auth)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(false, {}))
    const apiClient = makeApiClient()

    const { result } = renderHook(() => useAuthProvider({ apiClient }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/auth/refresh')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
  })

  it('honors a custom authBase for the refresh call', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(false, {}))
    const apiClient = makeApiClient()

    const { result } = renderHook(() => useAuthProvider({ apiClient, authBase: '/custom-auth' }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/custom-auth/refresh')
  })

  it('on successful refresh + successful /me, sets user and calls apiClient.setAccessToken', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(true, { accessToken: 'tok-123' }))
      .mockResolvedValueOnce(jsonResponse(true, testUser))
    const apiClient = makeApiClient()

    const { result } = renderHook(() => useAuthProvider({ apiClient }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.user).toEqual(testUser)
    expect(apiClient.setAccessToken).toHaveBeenCalledWith('tok-123')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [meUrl, meInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(meUrl).toBe('/auth/me')
    expect(header(meInit, 'Authorization')).toBe('Bearer tok-123')
    expect(meInit.credentials).toBe('include')
  })

  it('on successful refresh but failed /me, user stays null', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(true, { accessToken: 'tok-123' }))
      .mockResolvedValueOnce(jsonResponse(false, {}))
    const apiClient = makeApiClient()

    const { result } = renderHook(() => useAuthProvider({ apiClient }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.user).toBeNull()
  })

  it('when refresh is not ok, user stays null and /me is never called', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(false, {}))
    const apiClient = makeApiClient()

    const { result } = renderHook(() => useAuthProvider({ apiClient }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.user).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('when refresh throws, user stays null, loading becomes false, and /me is never called', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    const apiClient = makeApiClient()

    const { result } = renderHook(() => useAuthProvider({ apiClient }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.user).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('useAuthProvider - setUser', () => {
  it('synchronously sets user to exactly the object passed in', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(false, {}))
    const apiClient = makeApiClient()

    const { result } = renderHook(() => useAuthProvider({ apiClient }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setUser(testUser)
    })

    expect(result.current.user).toBe(testUser)
  })
})

describe('useAuthProvider - logout', () => {
  it('calls POST `${authBase}/logout`, clears the api client token, and sets user to null', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(true, { accessToken: 'tok-123' }))
      .mockResolvedValueOnce(jsonResponse(true, testUser))
    const apiClient = makeApiClient()

    const { result } = renderHook(() => useAuthProvider({ apiClient }))
    await waitFor(() => expect(result.current.user).toEqual(testUser))

    fetchMock.mockResolvedValueOnce(jsonResponse(true, {}))

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(apiClient.setAccessToken).toHaveBeenCalledWith(null)

    const [logoutUrl, logoutInit] = fetchMock.mock.calls[2] as [string, RequestInit]
    expect(logoutUrl).toBe('/auth/logout')
    expect(logoutInit.method).toBe('POST')
    expect(logoutInit.credentials).toBe('include')
  })

  it('honors a custom authBase for the logout call', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(false, {}))
    const apiClient = makeApiClient()

    const { result } = renderHook(() => useAuthProvider({ apiClient, authBase: '/custom-auth' }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    fetchMock.mockResolvedValueOnce(jsonResponse(true, {}))
    await act(async () => {
      await result.current.logout()
    })

    const [logoutUrl] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(logoutUrl).toBe('/custom-auth/logout')
  })

  it('still clears the user and token even when the logout fetch fails', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(false, {}))
    const apiClient = makeApiClient()

    const { result } = renderHook(() => useAuthProvider({ apiClient }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setUser(testUser)
    })
    expect(result.current.user).toEqual(testUser)

    fetchMock.mockRejectedValueOnce(new Error('network down'))

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(apiClient.setAccessToken).toHaveBeenCalledWith(null)
  })
})

describe('useAuth', () => {
  it('returns exactly the value provided by AuthContext.Provider', () => {
    const value: AuthState = {
      user: testUser,
      loading: false,
      logout: vi.fn(async () => {}),
      setUser: vi.fn(),
    }

    function Consumer() {
      const auth = useAuth()
      return <div data-testid="email">{auth.user?.email}</div>
    }

    render(
      <AuthContext.Provider value={value}>
        <Consumer />
      </AuthContext.Provider>,
    )

    expect(screen.getByTestId('email').textContent).toBe('a@example.test')
  })
})
