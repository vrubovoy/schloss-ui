import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../auth/apiClient'
import { useAvatarUrl } from './useAvatarUrl'

function response(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(body) } as unknown as Response
}

function makeApiClient(token: string | null = 'token-1'): ApiClient & { refreshAccessToken: NonNullable<ApiClient['refreshAccessToken']> } {
  let currentToken = token
  return {
    setAccessToken: vi.fn((next) => { currentToken = next }),
    getAccessToken: vi.fn(() => currentToken),
    refreshAccessToken: vi.fn(async () => null),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useAvatarUrl', () => {
  it('returns null and fetches nothing without a userId', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useAvatarUrl({
      schluesselOrigin: 'https://auth.localhost', userId: null, apiClient: makeApiClient(),
    }))
    expect(result.current).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches GET /auth/profile with the bearer token and returns avatarDataUrl', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, { avatarDataUrl: 'data:image/png;base64,xyz' }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useAvatarUrl({
      schluesselOrigin: 'https://auth.localhost', userId: 'user-1', apiClient: makeApiClient(),
    }))

    await waitFor(() => expect(result.current).toBe('data:image/png;base64,xyz'))
    expect(fetchMock).toHaveBeenCalledWith(
      'https://auth.localhost/auth/profile',
      expect.objectContaining({ headers: { Authorization: 'Bearer token-1' } }),
    )
  })

  it('returns null when the profile has no avatar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, { avatarDataUrl: null })))
    const { result } = renderHook(() => useAvatarUrl({
      schluesselOrigin: 'https://auth.localhost', userId: 'user-1', apiClient: makeApiClient(),
    }))
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled())
    expect(result.current).toBeNull()
  })

  it('retries once with a refreshed token after a 401', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(401, { error: 'unauthorized' }))
      .mockResolvedValueOnce(response(200, { avatarDataUrl: 'data:image/png;base64,refreshed' }))
    vi.stubGlobal('fetch', fetchMock)
    const apiClient = makeApiClient()
    vi.mocked(apiClient.refreshAccessToken).mockResolvedValue('token-2')
    apiClient.getAccessToken = vi.fn()
      .mockReturnValueOnce('token-1')

    const { result } = renderHook(() => useAvatarUrl({
      schluesselOrigin: 'https://auth.localhost', userId: 'user-1', apiClient,
    }))

    await waitFor(() => expect(result.current).toBe('data:image/png;base64,refreshed'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stays null on a non-ok response or malformed payload, without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(500, {})))
    const { result } = renderHook(() => useAvatarUrl({
      schluesselOrigin: 'https://auth.localhost', userId: 'user-1', apiClient: makeApiClient(),
    }))
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled())
    expect(result.current).toBeNull()
  })

  it('rejects an unsafe/non-https origin and fetches nothing', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useAvatarUrl({
      schluesselOrigin: 'javascript:alert(1)', userId: 'user-1', apiClient: makeApiClient(),
    }))
    expect(result.current).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
