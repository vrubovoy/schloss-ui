import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createApiClient } from './apiClient'

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response
}

function noBodyResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.reject(new Error(`json() should not be called for status ${status}`)),
    text: () => Promise.resolve(''),
  } as Response
}

function header(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name)
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('setAccessToken / getAccessToken', () => {
  it('returns null before any token is set', () => {
    const client = createApiClient({ base: '/api', onUnauthorized: vi.fn() })
    expect(client.getAccessToken()).toBeNull()
  })

  it('returns what was set', () => {
    const client = createApiClient({ base: '/api', onUnauthorized: vi.fn() })
    client.setAccessToken('abc123')
    expect(client.getAccessToken()).toBe('abc123')
  })

  it('can be reset to null', () => {
    const client = createApiClient({ base: '/api', onUnauthorized: vi.fn() })
    client.setAccessToken('abc123')
    client.setAccessToken(null)
    expect(client.getAccessToken()).toBeNull()
  })

  it('is independent between separate client instances', () => {
    const clientA = createApiClient({ base: '/api', onUnauthorized: vi.fn() })
    const clientB = createApiClient({ base: '/api', onUnauthorized: vi.fn() })
    clientA.setAccessToken('token-a')
    expect(clientA.getAccessToken()).toBe('token-a')
    expect(clientB.getAccessToken()).toBeNull()
  })
})

describe('get', () => {
  it('calls fetch with `${base}${path}`, credentials: include, and Content-Type: application/json', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { hello: 'world' }))
    const client = createApiClient({ base: '/api', onUnauthorized: vi.fn() })

    const result = await client.get('/foo')

    expect(result).toEqual({ hello: 'world' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/foo')
    expect(init.credentials).toBe('include')
    expect(header(init, 'Content-Type')).toBe('application/json')
  })

  it('does not send an Authorization header when no token is set', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}))
    const client = createApiClient({ base: '/api', onUnauthorized: vi.fn() })

    await client.get('/foo')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(header(init, 'Authorization')).toBeNull()
  })

  it('sends `Authorization: Bearer <token>` when a token is set', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}))
    const client = createApiClient({ base: '/api', onUnauthorized: vi.fn() })
    client.setAccessToken('my-token')

    await client.get('/foo')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(header(init, 'Authorization')).toBe('Bearer my-token')
  })

  it('resolves with undefined on a 204 response (and does not call .json())', async () => {
    fetchMock.mockResolvedValueOnce(noBodyResponse(204))
    const client = createApiClient({ base: '/api', onUnauthorized: vi.fn() })

    const result = await client.get('/foo')

    expect(result).toBeUndefined()
  })

  it('rejects with an ApiError whose status matches on a non-401 non-ok response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { message: 'boom' }))
    const client = createApiClient({ base: '/api', onUnauthorized: vi.fn() })

    await expect(client.get('/foo')).rejects.toBeInstanceOf(ApiError)
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { message: 'boom' }))
    await expect(client.get('/foo')).rejects.toMatchObject({ status: 500 })
  })
})

describe('post / put / delete', () => {
  it('post sends method: POST and JSON.stringify(body)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: 1 }))
    const client = createApiClient({ base: '/api', onUnauthorized: vi.fn() })

    const result = await client.post('/things', { name: 'widget' })

    expect(result).toEqual({ id: 1 })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/things')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ name: 'widget' }))
    expect(init.credentials).toBe('include')
    expect(header(init, 'Content-Type')).toBe('application/json')
  })

  it('put sends method: PUT and JSON.stringify(body)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: 1, name: 'updated' }))
    const client = createApiClient({ base: '/api', onUnauthorized: vi.fn() })

    const result = await client.put('/things/1', { name: 'updated' })

    expect(result).toEqual({ id: 1, name: 'updated' })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/things/1')
    expect(init.method).toBe('PUT')
    expect(init.body).toBe(JSON.stringify({ name: 'updated' }))
  })

  it('delete sends method: DELETE', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }))
    const client = createApiClient({ base: '/api', onUnauthorized: vi.fn() })

    const result = await client.delete('/things/1')

    expect(result).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/things/1')
    expect(init.method).toBe('DELETE')
    expect(init.credentials).toBe('include')
  })
})

describe('401 handling - refresh + retry', () => {
  it('on 401, calls POST `${authBase}/refresh` with credentials: include (default authBase /auth)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'unauthorized' }))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'new-token' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: 'ok' }))
    const client = createApiClient({ base: '/api', onUnauthorized: vi.fn() })

    await client.get('/foo')

    expect(fetchMock).toHaveBeenCalledTimes(3)
    const [refreshUrl, refreshInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(refreshUrl).toBe('/auth/refresh')
    expect(refreshInit.method).toBe('POST')
    expect(refreshInit.credentials).toBe('include')
  })

  it('honors a custom authBase for the refresh call', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'new-token' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: 'ok' }))
    const client = createApiClient({ base: '/api', authBase: '/custom-auth', onUnauthorized: vi.fn() })

    await client.get('/foo')

    const [refreshUrl] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(refreshUrl).toBe('/custom-auth/refresh')
  })

  it('on successful refresh, stores the new token and retries the original request once with it', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'refreshed-token' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: 'retried-ok' }))
    const client = createApiClient({ base: '/api', onUnauthorized: vi.fn() })
    client.setAccessToken('stale-token')

    const result = await client.get('/foo')

    expect(result).toEqual({ data: 'retried-ok' })
    expect(client.getAccessToken()).toBe('refreshed-token')

    const [retryUrl, retryInit] = fetchMock.mock.calls[2] as [string, RequestInit]
    expect(retryUrl).toBe('/api/foo')
    expect(header(retryInit, 'Authorization')).toBe('Bearer refreshed-token')
  })

  it("the retry's own outcome (success) becomes the outer call's result", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'tok2' }))
      .mockResolvedValueOnce(jsonResponse(200, { final: true }))
    const client = createApiClient({ base: '/api', onUnauthorized: vi.fn() })

    await expect(client.get('/foo')).resolves.toEqual({ final: true })
  })

  it("the retry's own outcome (failure) becomes the outer call's result", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'tok2' }))
      .mockResolvedValueOnce(jsonResponse(500, { message: 'still broken' }))
    const client = createApiClient({ base: '/api', onUnauthorized: vi.fn() })

    await expect(client.get('/foo')).rejects.toMatchObject({ status: 500 })
  })

  it('when the request is still 401 after refresh, clears the token and calls onUnauthorized once', async () => {
    const onUnauthorized = vi.fn()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'refreshed-token' }))
      .mockResolvedValueOnce(jsonResponse(401, { message: 'still unauthorized' }))
    const client = createApiClient({ base: '/api', onUnauthorized })
    client.setAccessToken('stale-token')

    await expect(client.get('/foo')).rejects.toMatchObject({ status: 401 })

    expect(client.getAccessToken()).toBeNull()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('when refresh itself is not ok, calls onUnauthorized, clears the token, and rejects with ApiError status 401', async () => {
    const onUnauthorized = vi.fn()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(500, { message: 'refresh failed' }))
    const client = createApiClient({ base: '/api', onUnauthorized })
    client.setAccessToken('stale-token')

    await expect(client.get('/foo')).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(client.getAccessToken()).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('when the refresh fetch itself throws, calls onUnauthorized, clears the token, and rejects with ApiError status 401', async () => {
    const onUnauthorized = vi.fn()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockRejectedValueOnce(new Error('network down'))
    const client = createApiClient({ base: '/api', onUnauthorized })
    client.setAccessToken('stale-token')

    await expect(client.get('/foo')).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(client.getAccessToken()).toBeNull()
  })

  it('rejects with an instance of ApiError (not just an object shape) on unrecoverable 401', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(500, {}))
    const client = createApiClient({ base: '/api', onUnauthorized: vi.fn() })

    await expect(client.get('/foo')).rejects.toBeInstanceOf(ApiError)
  })

  it('does not clear or redirect for a newer token set while the automatic refresh is in flight', async () => {
    let resolveRefresh!: (response: Response) => void
    const onUnauthorized = vi.fn()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveRefresh = resolve }))
    const client = createApiClient({ base: '/api', onUnauthorized })
    client.setAccessToken('expired-token')

    const request = client.get('/foo')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    client.setAccessToken('newer-token')
    resolveRefresh(jsonResponse(200, { accessToken: 'late-token' }))

    await expect(request).rejects.toMatchObject({ status: 401 })
    expect(client.getAccessToken()).toBe('newer-token')
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('does not refresh or replay a stale 401 that arrives after the external session generation changes', async () => {
    let resolveRequest!: (response: Response) => void
    const onUnauthorized = vi.fn()
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { resolveRequest = resolve }))
    const client = createApiClient({ base: '/api', onUnauthorized })
    client.setAccessToken('old-token')

    const request = client.get('/foo')
    client.setAccessToken('newer-token')
    resolveRequest(jsonResponse(401, {}))

    await expect(request).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(client.getAccessToken()).toBe('newer-token')
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('retries a concurrent old-token 401 with the token refreshed by a sibling request', async () => {
    let resolveSecondRequest!: (response: Response) => void
    const onUnauthorized = vi.fn()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveSecondRequest = resolve }))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'fresh-token' }))
      .mockResolvedValueOnce(jsonResponse(200, { request: 'first' }))
      .mockResolvedValueOnce(jsonResponse(200, { request: 'second' }))
    const client = createApiClient({ base: '/api', onUnauthorized })
    client.setAccessToken('old-token')

    const first = client.get('/first')
    const second = client.get('/second')
    await expect(first).resolves.toEqual({ request: 'first' })
    resolveSecondRequest(jsonResponse(401, {}))
    await expect(second).resolves.toEqual({ request: 'second' })

    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(fetchMock.mock.calls.filter(([url]) => url === '/auth/refresh')).toHaveLength(1)
    const [retryUrl, retryInit] = fetchMock.mock.calls[4] as [string, RequestInit]
    expect(retryUrl).toBe('/api/second')
    expect(header(retryInit, 'Authorization')).toBe('Bearer fresh-token')
    expect(client.getAccessToken()).toBe('fresh-token')
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})

describe('refreshAccessToken', () => {
  it('silently refreshes through the same-origin auth path and returns and stores the token', async () => {
    const onUnauthorized = vi.fn()
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { accessToken: 'fresh-token' }))
    const client = createApiClient({ base: '/api', authBase: '/custom-auth', onUnauthorized })

    await expect(client.refreshAccessToken()).resolves.toBe('fresh-token')

    expect(client.getAccessToken()).toBe('fresh-token')
    expect(fetchMock).toHaveBeenCalledWith('/custom-auth/refresh', { method: 'POST', credentials: 'include' })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('returns null without redirecting when refresh fails', async () => {
    const onUnauthorized = vi.fn()
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}))
    const client = createApiClient({ base: '/api', onUnauthorized })

    await expect(client.refreshAccessToken()).resolves.toBeNull()
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('is single-flight across concurrent callers', async () => {
    const pending = new Promise<Response>((resolve) => {
      queueMicrotask(() => resolve(jsonResponse(200, { accessToken: 'shared-token' })))
    })
    fetchMock.mockReturnValueOnce(pending)
    const client = createApiClient({ base: '/api', onUnauthorized: vi.fn() })

    const first = client.refreshAccessToken()
    const second = client.refreshAccessToken()

    expect(first).toBe(second)
    await expect(Promise.all([first, second])).resolves.toEqual(['shared-token', 'shared-token'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not restore a token when logout occurs while refresh is in flight', async () => {
    let resolveRefresh!: (response: Response) => void
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { resolveRefresh = resolve }))
    const client = createApiClient({ base: '/api', onUnauthorized: vi.fn() })
    client.setAccessToken('expired-token')

    const refresh = client.refreshAccessToken()
    client.setAccessToken(null)
    resolveRefresh(jsonResponse(200, { accessToken: 'late-token' }))

    await expect(refresh).resolves.toBeNull()
    expect(client.getAccessToken()).toBeNull()
  })

  it('does not overwrite a newer token when an older refresh finishes late', async () => {
    let resolveRefresh!: (response: Response) => void
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { resolveRefresh = resolve }))
    const client = createApiClient({ base: '/api', onUnauthorized: vi.fn() })
    client.setAccessToken('expired-token')

    const refresh = client.refreshAccessToken()
    client.setAccessToken('newer-token')
    resolveRefresh(jsonResponse(200, { accessToken: 'late-token' }))

    await expect(refresh).resolves.toBeNull()
    expect(client.getAccessToken()).toBe('newer-token')
  })

  it('scopes single-flight refreshes to their external session generation', async () => {
    let resolveOld!: (response: Response) => void
    let resolveNew!: (response: Response) => void
    fetchMock
      .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveOld = resolve }))
      .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveNew = resolve }))
    const client = createApiClient({ base: '/api', onUnauthorized: vi.fn() })
    client.setAccessToken('old-token')

    const oldFlight = client.refreshAccessToken()
    client.setAccessToken('newer-token')
    const newFlight = client.refreshAccessToken()

    expect(newFlight).not.toBe(oldFlight)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    resolveOld(jsonResponse(200, { accessToken: 'stale-refreshed-token' }))
    await expect(oldFlight).resolves.toBeNull()

    const joinedNewFlight = client.refreshAccessToken()
    expect(joinedNewFlight).toBe(newFlight)
    resolveNew(jsonResponse(200, { accessToken: 'current-refreshed-token' }))

    await expect(Promise.all([newFlight, joinedNewFlight])).resolves.toEqual([
      'current-refreshed-token',
      'current-refreshed-token',
    ])
    expect(client.getAccessToken()).toBe('current-refreshed-token')
  })
})
