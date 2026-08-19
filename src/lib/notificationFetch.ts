import type { ApiClient } from '../auth/apiClient'

export interface RecentNotification {
  id: string
  title: string
  body: string
  actionUrl: string | null
  createdAt: string
  readAt: string | null
}

export function isRecentNotification(value: unknown): value is RecentNotification {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record['id'] === 'string'
    && typeof record['title'] === 'string'
    && typeof record['body'] === 'string'
    && (record['actionUrl'] === null || typeof record['actionUrl'] === 'string')
    && typeof record['createdAt'] === 'string'
    && (record['readAt'] === null || typeof record['readAt'] === 'string')
}

// One-shot authenticated fetch to Glocke's cross-origin API, mirroring
// useUnreadNotifications.ts's own retry-once-on-401 shape but without its
// polling/cross-tab machinery - shared by the hover dropdown and the
// new-arrival toast, both of which fetch on demand rather than continuously.
export async function authedFetch(
  origin: string, apiClient: ApiClient, path: string, init: RequestInit, signal: AbortSignal,
): Promise<Response> {
  const token = apiClient.getAccessToken()
  if (!token) throw new Error('no access token')
  const attempt = (bearer: string) => fetch(`${origin}${path}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${bearer}` },
    credentials: 'omit',
    signal,
  })
  let response = await attempt(token)
  if (response.status === 401 && apiClient.refreshAccessToken) {
    const refreshed = await apiClient.refreshAccessToken()
    if (refreshed) response = await attempt(refreshed)
  }
  return response
}

// GET /notifications returns actionUrl exactly as Glocke's producers/
// renderer stored it - some (Kuvert/Tafel's own domain events) are already
// absolute (their own origin), others (e.g. schlussel.security.
// password_changed.v1's "/settings") are deliberately relative, meant to
// resolve against GLOCKE'S origin. That's transparent when rendered on
// Glocke's own notification page (a relative href just resolves against
// the current page like any other), but the dropdown/toast render on
// EVERY app's own page now - passing a relative actionUrl straight to
// window.location.href there resolves it against the wrong origin
// entirely (e.g. https://kuvert.localhost/settings, 404).
export function resolveActionUrl(actionUrl: string | null, glockeOrigin: string, fallback: string): string {
  if (!actionUrl) return fallback
  try {
    return new URL(actionUrl).href
  } catch {
    try {
      return new URL(actionUrl, glockeOrigin).href
    } catch {
      return fallback
    }
  }
}

export async function fetchRecentNotifications(
  origin: string, apiClient: ApiClient, limit: number, signal: AbortSignal,
): Promise<RecentNotification[] | null> {
  const response = await authedFetch(origin, apiClient, `/backend/notifications?limit=${limit}`, {}, signal)
  if (!response.ok) return null
  const payload = await response.json() as { items?: unknown }
  return Array.isArray(payload.items) ? payload.items.filter(isRecentNotification) : null
}
