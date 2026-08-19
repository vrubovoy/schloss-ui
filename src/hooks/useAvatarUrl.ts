import { useEffect, useState } from 'react'
import type { ApiClient } from '../auth/apiClient'
import { normalizeNotificationOrigin } from './useUnreadNotifications'

export interface UseAvatarUrlOptions {
  /** Schlüssel's public origin (the same auth origin every app already
   * redirects to for login/account) - reuses normalizeNotificationOrigin's
   * origin-shape/SSRF validation, which is generic despite its name. */
  schluesselOrigin: string
  userId: string | null
  apiClient: ApiClient
}

function isProfileWithAvatar(value: unknown): value is { avatarDataUrl: string | null } {
  if (!value || typeof value !== 'object') return false
  const avatarDataUrl = (value as Record<string, unknown>)['avatarDataUrl']
  return avatarDataUrl === null || typeof avatarDataUrl === 'string'
}

/** The current user's uploaded avatar as a ready-to-render data: URL, or
 * null if they have none (or it couldn't be fetched) - callers fall back
 * to their own initial-letter avatar in that case. Fetched once per
 * userId/token (avatarDataUrl already comes back as a full `data:image/
 * ...;base64,...` string from GET /auth/profile - the exact same
 * authenticated cross-origin bearer-fetch shape useUnreadNotifications
 * uses for Glocke, reused here since Schlüssel's CORS allowlist already
 * permits every app origin and /auth/profile is bearer-only, no
 * same-origin/cookie requirement). */
export function useAvatarUrl({ schluesselOrigin, userId, apiClient }: UseAvatarUrlOptions): string | null {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const normalizedOrigin = normalizeNotificationOrigin(schluesselOrigin)

  useEffect(() => {
    setAvatarUrl(null)
    if (!normalizedOrigin || !userId) return

    let active = true
    const controller = new AbortController()

    void (async () => {
      const token = apiClient.getAccessToken()
      if (!token) return
      const attempt = (bearer: string) => fetch(`${normalizedOrigin}/auth/profile`, {
        headers: { Authorization: `Bearer ${bearer}` },
        credentials: 'omit',
        signal: controller.signal,
      })
      try {
        let response = await attempt(token)
        if (response.status === 401 && apiClient.refreshAccessToken) {
          const refreshed = await apiClient.refreshAccessToken()
          if (refreshed) response = await attempt(refreshed)
        }
        if (!response.ok || !active) return
        const payload: unknown = await response.json()
        if (active && isProfileWithAvatar(payload)) setAvatarUrl(payload.avatarDataUrl)
      } catch {
        // Leave avatarUrl at null - the caller's own initial-letter
        // fallback is a perfectly fine degraded state, not an error worth
        // surfacing.
      }
    })()

    return () => { active = false; controller.abort() }
  }, [normalizedOrigin, userId, apiClient])

  return avatarUrl
}
