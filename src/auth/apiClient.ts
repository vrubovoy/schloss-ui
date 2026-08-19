export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export interface ApiClient {
  setAccessToken(token: string | null): void
  getAccessToken(): string | null
  /** Optional for source compatibility; createApiClient always provides it. */
  refreshAccessToken?(): Promise<string | null>
  get<T>(path: string): Promise<T>
  post<T>(path: string, body: unknown): Promise<T>
  put<T>(path: string, body: unknown): Promise<T>
  /** Optional for source compatibility with callers/mocks written before
   * this method existed (e.g. hand-built ApiClient test doubles) -
   * createApiClient always provides it, same as refreshAccessToken above. */
  patch?<T>(path: string, body: unknown): Promise<T>
  delete<T>(path: string): Promise<T>
}

export interface CreatedApiClient extends ApiClient {
  /** Silently refreshes the in-memory token without invoking onUnauthorized. */
  refreshAccessToken(): Promise<string | null>
  patch<T>(path: string, body: unknown): Promise<T>
}

export interface CreateApiClientConfig {
  // This app's own API prefix, e.g. '/api'.
  base: string
  // The schlussel auth-proxy prefix every app's own Caddyfile/dev-server
  // reverse-proxies to schlussel under - every app on the platform uses
  // the same '/auth' convention, so this only needs overriding if a future
  // service deviates from it.
  authBase?: string
  // Called when a request 401s and the subsequent refresh attempt also
  // fails - there's no generic "go log in" default here (a bare '/login'
  // path doesn't exist in most apps, which have no local login route at
  // all), so the caller must say what "give up" means for them, e.g.
  // navigating to buildLoginUrl(...).
  onUnauthorized: () => void
}

export function createApiClient(config: CreateApiClientConfig): CreatedApiClient {
  const { base, onUnauthorized } = config
  const authBase = config.authBase ?? '/auth'

  let accessToken: string | null = null
  let sessionGeneration = 0
  let refreshFlight: { generation: number; promise: Promise<string | null> } | null = null

  function setAccessToken(token: string | null) {
    accessToken = token
    sessionGeneration += 1
  }

  function getAccessToken() {
    return accessToken
  }

  function refreshAccessToken(): Promise<string | null> {
    const refreshGeneration = sessionGeneration
    if (refreshFlight?.generation === refreshGeneration) return refreshFlight.promise

    const promise = (async () => {
      try {
        const res = await fetch(`${authBase}/refresh`, { method: 'POST', credentials: 'include' })
        if (!res.ok) return null
        const data = (await res.json()) as { accessToken?: unknown }
        if (typeof data.accessToken !== 'string' || data.accessToken.length === 0) return null
        if (sessionGeneration !== refreshGeneration) return null
        accessToken = data.accessToken
        return data.accessToken
      } catch {
        return null
      }
    })()
    refreshFlight = { generation: refreshGeneration, promise }
    void promise.then(
      () => { if (refreshFlight?.promise === promise) refreshFlight = null },
      () => { if (refreshFlight?.promise === promise) refreshFlight = null },
    )
    return promise
  }

  async function retryRequest<T>(
    path: string,
    init: RequestInit,
    headers: Record<string, string>,
    token: string,
    expectedSession: number,
  ): Promise<T> {
    headers['Authorization'] = `Bearer ${token}`
    const retry = await fetch(`${base}${path}`, { ...init, headers, credentials: 'include' })
    if (sessionGeneration !== expectedSession) throw new ApiError(401, 'Unauthorized')
    if (retry.status === 401 && sessionGeneration === expectedSession) {
      setAccessToken(null)
      onUnauthorized()
    }
    if (!retry.ok) throw new ApiError(retry.status, await retry.text())
    if (retry.status === 204) return undefined as T
    return retry.json() as Promise<T>
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const requestSession = sessionGeneration
    const requestToken = accessToken
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string>),
    }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

    const res = await fetch(`${base}${path}`, { ...init, headers, credentials: 'include' })
    if (sessionGeneration !== requestSession) throw new ApiError(401, 'Unauthorized')

    if (res.status === 401) {
      // A sibling request may already have refreshed this session while this
      // request was in flight. Reuse its token without launching another refresh.
      if (accessToken && accessToken !== requestToken) {
        return retryRequest<T>(path, init, headers, accessToken, requestSession)
      }

      const refreshedToken = await refreshAccessToken()
      if (refreshedToken) {
        return retryRequest<T>(path, init, headers, refreshedToken, requestSession)
      }
      if (sessionGeneration === requestSession) {
        setAccessToken(null)
        onUnauthorized()
      }
      throw new ApiError(401, 'Unauthorized')
    }

    if (!res.ok) throw new ApiError(res.status, await res.text())
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  return {
    setAccessToken,
    getAccessToken,
    refreshAccessToken,
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
    put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
    patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  }
}
