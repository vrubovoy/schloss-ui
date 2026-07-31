import { useState, useEffect, createContext, useContext } from 'react'
import type { ApiClient } from './apiClient.js'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
}

export interface AuthState {
  user: AuthUser | null
  loading: boolean
  logout: () => Promise<void>
  // Set directly by an app's own AuthCallbackPage once it resolves the
  // token exchange - the on-mount silent-refresh effect below only runs
  // once, so it can't pick this up on its own.
  setUser: (user: AuthUser) => void
}

export const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  logout: async () => {},
  setUser: () => {},
})

export function useAuth(): AuthState {
  return useContext(AuthContext)
}

export interface UseAuthProviderConfig {
  apiClient: ApiClient
  // The schlussel auth-proxy prefix, matching createApiClient's own
  // convention - default '/auth'.
  authBase?: string
}

export function useAuthProvider(config: UseAuthProviderConfig): AuthState {
  const { apiClient } = config
  const authBase = config.authBase ?? '/auth'

  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  function schluesselFetch(path: string, init?: RequestInit) {
    return fetch(`${authBase}${path}`, { ...init, credentials: 'include' })
  }

  useEffect(() => {
    schluesselFetch('/refresh', { method: 'POST' })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (data: { accessToken: string } | null) => {
        if (!data?.accessToken) return null
        apiClient.setAccessToken(data.accessToken)
        const me = await schluesselFetch('/me', {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        })
        return me.ok ? (me.json() as Promise<AuthUser>) : null
      })
      .then((u) => setUser(u ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
    // Runs once on mount only - apiClient/authBase come from the caller's
    // own stable config, not meant to re-trigger this bootstrap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Also clears the app's OWN session cookie: every proxied /auth/token or
  // /auth/refresh call this app makes gets a Set-Cookie response that the
  // browser scopes to the app's own origin (no Domain attribute, by
  // design) - a second, fully independent cookie schlussel's own
  // same-origin /logout page (see authRedirect.ts, navigated to right
  // after this) can never see or clear. This proxied /auth/logout call
  // clears that one immediately instead of leaving it to expire on its own.
  async function logout() {
    await schluesselFetch('/logout', { method: 'POST' }).catch(() => {})
    apiClient.setAccessToken(null)
    setUser(null)
  }

  return { user, loading, logout, setUser }
}
