import { useEffect, useRef, useState } from 'react'
import type { ApiClient } from '../auth/apiClient'
import type { HeaderNotificationState } from '../components/Header'

const POLL_INTERVAL_MS = 60_000
const POLL_JITTER_MS = 6_000
const RECOVERY_THROTTLE_MS = 5_000
const UNREAD_INVALIDATION_EVENT = 'schloss-ui:notification-unread-count-invalidated'
const UNREAD_INVALIDATION_CHANNEL = 'schloss-ui:notification-unread-count'
const UNREAD_INVALIDATION_MESSAGE = 'invalidate'
const INVALIDATION_SOURCE = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`

interface UnreadInvalidationMessage {
  type: typeof UNREAD_INVALIDATION_MESSAGE
  source: string
}

export interface UseUnreadNotificationsOptions {
  glockeOrigin: string
  userId: string | null
  apiClient: ApiClient
}

export type UnreadNotificationsState = HeaderNotificationState
const UNAVAILABLE_STATE: UnreadNotificationsState = { status: 'error' }

function isUnreadInvalidationMessage(value: unknown): value is UnreadInvalidationMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Partial<UnreadInvalidationMessage>
  return message.type === UNREAD_INVALIDATION_MESSAGE && typeof message.source === 'string'
}

/** Signals that notification mutations may have changed the unread count. */
export function invalidateNotificationUnreadCount(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(UNREAD_INVALIDATION_EVENT))
  if (typeof BroadcastChannel === 'undefined') return

  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(UNREAD_INVALIDATION_CHANNEL)
    channel.postMessage({ type: UNREAD_INVALIDATION_MESSAGE, source: INVALIDATION_SOURCE } satisfies UnreadInvalidationMessage)
  } catch {
    // Same-window invalidation still works when BroadcastChannel is unavailable.
  } finally {
    channel?.close()
  }
}

function isNonPublicHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  // Any *.localhost host, not just glocke's own - the .localhost TLD is
  // always loopback-safe per RFC 6761 (browsers/OS resolve it specially),
  // so singling out one hardcoded subdomain rejected every other service's
  // own *.localhost dev origin (e.g. auth.localhost) for no security
  // reason - this function is reused by other origin-validating callers
  // (see useAvatarUrl.ts), not just the notifications one it's named for.
  if (host === 'localhost' || host.endsWith('.localhost')) return false
  if (!host.includes('.') && !host.includes(':')) return true
  if (['.internal', '.lan', '.local', '.localdomain', '.home', '.home.arpa'].some((suffix) => host.endsWith(suffix))) return true

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number)
    return a === 0
      || a === 10
      || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19))
      || a >= 224
  }

  if (host.includes(':')) {
    return host === '::'
      || host === '::1'
      || host.startsWith('::ffff:')
      || /^f[cd]/.test(host)
      || /^fe[89ab]/.test(host)
      || host.startsWith('ff')
  }
  return false
}

/** Validates and canonicalizes the public Glocke service origin. */
export function normalizeNotificationOrigin(value: string): string | null {
  const originSyntax = value.match(/^[a-z][a-z\d+.-]*:\/\/([^/?#\\]+)\/?$/i)
  if (!originSyntax || originSyntax[1].includes('@')) return null

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }

  const isOriginOnly = url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password
  const isSecure = url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost')
  if (!isOriginOnly || !isSecure || isNonPublicHost(url.hostname)) return null
  return url.origin
}

function isUnreadCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function pollingDelay(): number {
  return POLL_INTERVAL_MS + (Math.random() * 2 - 1) * POLL_JITTER_MS
}

export function useUnreadNotifications({
  glockeOrigin,
  userId,
  apiClient,
}: UseUnreadNotificationsOptions): UnreadNotificationsState {
  const normalizedOrigin = normalizeNotificationOrigin(glockeOrigin)
  const accessToken = normalizedOrigin ? apiClient.getAccessToken() : null
  const [state, setState] = useState<UnreadNotificationsState>(
    normalizedOrigin ? { status: 'loading' } : UNAVAILABLE_STATE,
  )
  const generationRef = useRef(0)
  const apiClientRef = useRef(apiClient)
  const trackedTokenRef = useRef(accessToken)
  const tokenGenerationRef = useRef(0)
  apiClientRef.current = apiClient
  if (trackedTokenRef.current !== accessToken) {
    trackedTokenRef.current = accessToken
    tokenGenerationRef.current += 1
  }
  const tokenGeneration = tokenGenerationRef.current

  useEffect(() => {
    const generation = ++generationRef.current
    if (!normalizedOrigin) return

    let active = true
    let controller: AbortController | null = null
    let inFlight: Promise<void> | null = null
    let invalidationQueued = false
    let pollTimer: ReturnType<typeof setTimeout> | null = null
    let lastGoodCount: number | undefined
    let lastRequestAt: number | null = null

    const isCurrent = () => active && generationRef.current === generation
    const canRequest = () => Boolean(
      userId
      && apiClientRef.current.getAccessToken()
      && document.visibilityState === 'visible'
      && navigator.onLine,
    )

    function updateError() {
      if (!isCurrent()) return
      setState(lastGoodCount === undefined
        ? { status: 'error' }
        : { status: 'error', unreadCount: lastGoodCount })
    }

    async function authenticatedFetch(token: string, signal: AbortSignal): Promise<Response> {
      return fetch(`${normalizedOrigin}/backend/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'omit',
        signal,
      })
    }

    function request(): Promise<void> {
      if (inFlight || !canRequest()) return inFlight ?? Promise.resolve()

      const requestToken = apiClientRef.current.getAccessToken()
      if (!requestToken) return Promise.resolve()

      lastRequestAt = Date.now()
      controller = new AbortController()
      const requestController = controller
      let run!: Promise<void>
      run = (async () => {
        try {
          let response = await authenticatedFetch(requestToken, requestController.signal)
          if (response.status === 401 && isCurrent()) {
            const client = apiClientRef.current
            if (client.getAccessToken() !== requestToken) {
              updateError()
              return
            }
            const refreshedToken = client.refreshAccessToken
              ? await client.refreshAccessToken()
              : null
            if (!isCurrent() || requestController.signal.aborted) return
            const liveToken = client.getAccessToken()
            if (refreshedToken && liveToken === refreshedToken) {
              trackedTokenRef.current = liveToken
              response = await authenticatedFetch(liveToken, requestController.signal)
            }
          }

          if (!response.ok) {
            updateError()
            return
          }
          const payload = (await response.json()) as { count?: unknown }
          if (!isUnreadCount(payload.count)) {
            updateError()
            return
          }
          if (!isCurrent()) return
          lastGoodCount = payload.count
          setState({ status: 'ready', unreadCount: payload.count })
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return
          updateError()
        } finally {
          if (inFlight === run) inFlight = null
          if (controller === requestController) controller = null
          if (isCurrent()) drainQueuedInvalidation()
        }
      })()
      inFlight = run
      return run
    }

    function drainQueuedInvalidation(): boolean {
      if (!invalidationQueued || inFlight || !canRequest()) return false
      invalidationQueued = false
      void request()
      schedulePoll()
      return true
    }

    function schedulePoll() {
      if (pollTimer) clearTimeout(pollTimer)
      if (!canRequest()) {
        pollTimer = null
        return
      }
      pollTimer = setTimeout(() => {
        pollTimer = null
        void request()
        schedulePoll()
      }, pollingDelay())
    }

    function recover() {
      if (!canRequest()) {
        if (pollTimer) clearTimeout(pollTimer)
        pollTimer = null
        return
      }
      if (invalidationQueued) {
        drainQueuedInvalidation()
        return
      }
      const now = Date.now()
      if (lastRequestAt !== null && now - lastRequestAt < RECOVERY_THROTTLE_MS) {
        schedulePoll()
        return
      }
      void request()
      schedulePoll()
    }

    function invalidate() {
      invalidationQueued = true
      if (!drainQueuedInvalidation()) schedulePoll()
    }

    let invalidationChannel: BroadcastChannel | null = null
    function handleInvalidationMessage(event: MessageEvent<unknown>) {
      if (!isUnreadInvalidationMessage(event.data) || event.data.source === INVALIDATION_SOURCE) return
      invalidate()
    }

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        invalidationChannel = new BroadcastChannel(UNREAD_INVALIDATION_CHANNEL)
        invalidationChannel.addEventListener('message', handleInvalidationMessage)
      } catch {
        invalidationChannel?.close()
        invalidationChannel = null
      }
    }

    setState({ status: 'loading' })
    if (canRequest()) {
      void request()
      schedulePoll()
    }

    window.addEventListener('focus', recover)
    window.addEventListener('pageshow', recover)
    window.addEventListener('online', recover)
    window.addEventListener('offline', recover)
    window.addEventListener(UNREAD_INVALIDATION_EVENT, invalidate)
    document.addEventListener('visibilitychange', recover)

    return () => {
      active = false
      invalidationQueued = false
      controller?.abort()
      if (pollTimer) clearTimeout(pollTimer)
      window.removeEventListener('focus', recover)
      window.removeEventListener('pageshow', recover)
      window.removeEventListener('online', recover)
      window.removeEventListener('offline', recover)
      window.removeEventListener(UNREAD_INVALIDATION_EVENT, invalidate)
      document.removeEventListener('visibilitychange', recover)
      if (invalidationChannel) {
        invalidationChannel.removeEventListener('message', handleInvalidationMessage)
        invalidationChannel.close()
      }
    }
  }, [normalizedOrigin, tokenGeneration, userId])

  return normalizedOrigin ? state : UNAVAILABLE_STATE
}
