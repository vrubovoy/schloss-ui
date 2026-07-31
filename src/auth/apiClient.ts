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
  get<T>(path: string): Promise<T>
  post<T>(path: string, body: unknown): Promise<T>
  put<T>(path: string, body: unknown): Promise<T>
  delete<T>(path: string): Promise<T>
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

export function createApiClient(config: CreateApiClientConfig): ApiClient {
  const { base, onUnauthorized } = config
  const authBase = config.authBase ?? '/auth'

  let accessToken: string | null = null

  function setAccessToken(token: string | null) {
    accessToken = token
  }

  function getAccessToken() {
    return accessToken
  }

  async function tryRefresh(): Promise<boolean> {
    try {
      const res = await fetch(`${authBase}/refresh`, { method: 'POST', credentials: 'include' })
      if (!res.ok) return false
      const data = (await res.json()) as { accessToken: string }
      setAccessToken(data.accessToken)
      return true
    } catch {
      return false
    }
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string>),
    }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

    const res = await fetch(`${base}${path}`, { ...init, headers, credentials: 'include' })

    if (res.status === 401) {
      const refreshed = await tryRefresh()
      if (refreshed) {
        headers['Authorization'] = `Bearer ${accessToken}`
        const retry = await fetch(`${base}${path}`, { ...init, headers, credentials: 'include' })
        if (!retry.ok) throw new ApiError(retry.status, await retry.text())
        if (retry.status === 204) return undefined as T
        return retry.json() as Promise<T>
      }
      setAccessToken(null)
      onUnauthorized()
      throw new ApiError(401, 'Unauthorized')
    }

    if (!res.ok) throw new ApiError(res.status, await res.text())
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  return {
    setAccessToken,
    getAccessToken,
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
    put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
    delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  }
}
