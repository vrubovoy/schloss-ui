import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../auth/apiClient'
import { invalidateNotificationUnreadCount, useUnreadNotifications } from './useUnreadNotifications'

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
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

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value })
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value })
}

class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = []
  readonly name: string
  readonly messages: unknown[] = []
  private readonly listeners = new Set<(event: MessageEvent<unknown>) => void>()
  private closed = false

  constructor(name: string) {
    this.name = name
    MockBroadcastChannel.instances.push(this)
  }

  postMessage(message: unknown) {
    this.messages.push(message)
    for (const channel of MockBroadcastChannel.instances) {
      if (channel === this || channel.closed || channel.name !== this.name) continue
      queueMicrotask(() => {
        const event = new MessageEvent('message', { data: message })
        for (const listener of channel.listeners) listener(event)
      })
    }
  }

  addEventListener(type: string, listener: (event: MessageEvent<unknown>) => void) {
    if (type === 'message') this.listeners.add(listener)
  }

  removeEventListener(type: string, listener: (event: MessageEvent<unknown>) => void) {
    if (type === 'message') this.listeners.delete(listener)
  }

  close() {
    this.closed = true
  }
}

const glockeOrigin = 'https://glocke.example.test'
const unreadUrl = `${glockeOrigin}/backend/notifications/unread-count`
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  MockBroadcastChannel.instances = []
  vi.stubGlobal('fetch', fetchMock)
  setVisibility('visible')
  setOnline(true)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useUnreadNotifications request contract', () => {
  it('degrades an invalid configured origin to a nonfatal unavailable state', () => {
    const windowListeners = vi.spyOn(window, 'addEventListener')
    const documentListeners = vi.spyOn(document, 'addEventListener')
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const broadcastChannel = vi.fn()
    vi.stubGlobal('BroadcastChannel', broadcastChannel)
    const { result } = renderHook(() => useUnreadNotifications({
      glockeOrigin: 'not-an-origin',
      userId: null,
      apiClient: makeApiClient(null),
    }))

    expect(result.current).toEqual({ status: 'error' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(setTimeoutSpy).not.toHaveBeenCalled()
    expect(broadcastChannel).not.toHaveBeenCalled()
    expect(windowListeners.mock.calls.map(([type]) => type)).not.toContain('focus')
    expect(windowListeners.mock.calls.map(([type]) => type)).not.toContain('schloss-ui:notification-unread-count-invalidated')
    expect(documentListeners.mock.calls.map(([type]) => type)).not.toContain('visibilitychange')
  })

  it('recovers normally when an invalid origin prop becomes valid', async () => {
    const apiClient = makeApiClient('token-1')
    fetchMock.mockResolvedValueOnce(response(200, { count: 3 }))
    const { result, rerender } = renderHook(
      ({ origin }) => useUnreadNotifications({ glockeOrigin: origin, userId: 'user-1', apiClient }),
      { initialProps: { origin: 'http://glocke.example.test/path' } },
    )

    expect(result.current).toEqual({ status: 'error' })
    expect(fetchMock).not.toHaveBeenCalled()

    rerender({ origin: glockeOrigin })
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', unreadCount: 3 }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('starts loading and immediately fetches the exact configured Glocke origin/path with bearer auth and omitted credentials', async () => {
    const pending = deferred<Response>()
    fetchMock.mockReturnValueOnce(pending.promise)
    const apiClient = makeApiClient('secret-token')

    const { result } = renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient }))

    expect(result.current).toEqual({ status: 'loading' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(unreadUrl)
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer secret-token')
    expect(init.credentials).toBe('omit')
    expect(init.signal).toBeInstanceOf(AbortSignal)

    pending.resolve(response(200, { count: 4 }))
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', unreadCount: 4 }))
  })

  it('does not fetch without both an authenticated user and access token', () => {
    const noUser = renderHook(() => useUnreadNotifications({ glockeOrigin, userId: null, apiClient: makeApiClient() }))
    const noToken = renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient: makeApiClient(null) }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(noUser.result.current).toEqual({ status: 'loading' })
    expect(noToken.result.current).toEqual({ status: 'loading' })
  })

  it.each([
    { count: '4' },
    { count: -1 },
    { count: 1.5 },
    { count: Number.NaN },
    {},
  ])('treats malformed count payload %# as a nonfatal error', async (body) => {
    fetchMock.mockResolvedValueOnce(response(200, body))
    const { result } = renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient: makeApiClient() }))

    await waitFor(() => expect(result.current).toEqual({ status: 'error' }))
  })

  it.each([
    ['network failure', () => Promise.reject(new TypeError('offline'))],
    ['server failure', () => Promise.resolve(response(503, { message: 'down' }))],
  ])('turns a %s into a nonfatal error', async (_name, result) => {
    fetchMock.mockImplementationOnce(result)
    const { result: hook } = renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient: makeApiClient() }))

    await waitFor(() => expect(hook.current).toEqual({ status: 'error' }))
  })

  it('accepts a huge safe integer count', async () => {
    fetchMock.mockResolvedValueOnce(response(200, { count: Number.MAX_SAFE_INTEGER }))
    const { result } = renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient: makeApiClient() }))

    await waitFor(() => expect(result.current).toEqual({ status: 'ready', unreadCount: Number.MAX_SAFE_INTEGER }))
  })
})

describe('useUnreadNotifications refresh lifecycle', () => {
  it('refreshes immediately when the current origin publishes an unread invalidation', async () => {
    fetchMock.mockResolvedValue(response(200, { count: 1 }))
    renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient: makeApiClient() }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    act(() => invalidateNotificationUnreadCount())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('coalesces unread invalidation with an unread request already in flight', async () => {
    const pending = deferred<Response>()
    fetchMock
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(response(200, { count: 2 }))
    const { result } = renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient: makeApiClient() }))

    act(() => {
      invalidateNotificationUnreadCount()
      invalidateNotificationUnreadCount()
      invalidateNotificationUnreadCount()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    pending.resolve(response(200, { count: 1 }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', unreadCount: 2 }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('queues one follow-up for cross-tab invalidations received during an unread request', async () => {
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)
    const pending = deferred<Response>()
    fetchMock
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(response(200, { count: 2 }))
    const { result } = renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient: makeApiClient() }))
    const hookChannel = MockBroadcastChannel.instances[0]
    const remoteTab = new MockBroadcastChannel(hookChannel.name)

    remoteTab.postMessage({ type: 'invalidate', source: 'another-tab' })
    remoteTab.postMessage({ type: 'invalidate', source: 'another-tab' })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    pending.resolve(response(200, { count: 1 }))
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', unreadCount: 2 }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    remoteTab.close()
  })

  it('broadcasts a safe cross-tab invalidation without double-fetching in the sender window', async () => {
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)
    fetchMock.mockResolvedValue(response(200, { count: 1 }))
    renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient: makeApiClient() }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    act(() => invalidateNotificationUnreadCount())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    const publisher = MockBroadcastChannel.instances.at(-1)
    expect(publisher?.messages).toHaveLength(1)
    expect(publisher?.messages[0]).toMatchObject({ type: 'invalidate' })
    expect(Object.keys(publisher?.messages[0] as object).sort()).toEqual(['source', 'type'])
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const remoteTab = new MockBroadcastChannel(publisher!.name)
    remoteTab.postMessage({ type: 'invalidate', source: 'another-tab' })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    remoteTab.close()
  })

  it('keeps same-window invalidation working when BroadcastChannel is unsupported', async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    fetchMock.mockResolvedValue(response(200, { count: 1 }))
    renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient: makeApiClient() }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    expect(() => invalidateNotificationUnreadCount()).not.toThrow()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('polls while visible and online at a jittered interval centered on 60 seconds', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.75)
    fetchMock.mockResolvedValue(response(200, { count: 1 }))
    renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient: makeApiClient() }))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(3_001) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['focus', () => window.dispatchEvent(new Event('focus'))],
    ['visibility', () => document.dispatchEvent(new Event('visibilitychange'))],
    ['pageshow', () => window.dispatchEvent(new PageTransitionEvent('pageshow'))],
    ['online', () => window.dispatchEvent(new Event('online'))],
  ])('refreshes on %s after the recovery throttle window', async (_name, dispatch) => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(response(200, { count: 1 }))
    renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient: makeApiClient() }))
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await vi.advanceTimersByTimeAsync(5_001) })

    act(dispatch)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('coalesces a burst of recovery events through one throttle', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(response(200, { count: 1 }))
    renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient: makeApiClient() }))
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await vi.advanceTimersByTimeAsync(5_001) })

    act(() => {
      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new PageTransitionEvent('pageshow'))
      window.dispatchEvent(new Event('online'))
    })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each(['hidden', 'offline'])('pauses polling and recovery fetches while %s, then fetches on recovery', async (condition) => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(response(200, { count: 1 }))
    renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient: makeApiClient() }))
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await vi.advanceTimersByTimeAsync(5_001) })

    if (condition === 'hidden') setVisibility('hidden')
    else setOnline(false)
    act(() => window.dispatchEvent(new Event('focus')))
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    if (condition === 'hidden') {
      setVisibility('visible')
      act(() => document.dispatchEvent(new Event('visibilitychange')))
    } else {
      setOnline(true)
      act(() => window.dispatchEvent(new Event('online')))
    }
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each(['hidden', 'offline'])('reschedules polling when recovering from %s inside the refresh throttle', async (condition) => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    fetchMock.mockResolvedValue(response(200, { count: 1 }))
    renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient: makeApiClient() }))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    if (condition === 'hidden') {
      setVisibility('hidden')
      act(() => document.dispatchEvent(new Event('visibilitychange')))
    } else {
      setOnline(false)
      act(() => window.dispatchEvent(new Event('offline')))
    }
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })

    if (condition === 'hidden') {
      setVisibility('visible')
      act(() => document.dispatchEvent(new Event('visibilitychange')))
    } else {
      setOnline(true)
      act(() => window.dispatchEvent(new Event('online')))
    }
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(60_001) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('allows only one unread request in flight', async () => {
    vi.useFakeTimers()
    const pending = deferred<Response>()
    fetchMock.mockReturnValue(pending.promise)
    renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient: makeApiClient() }))
    await act(async () => { await vi.advanceTimersByTimeAsync(65_000) })
    act(() => {
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('online'))
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    pending.resolve(response(200, { count: 1 }))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
  })

  it('does not poll with a cached token after the ApiClient token is cleared', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const apiClient = makeApiClient('live-token')
    fetchMock.mockResolvedValue(response(200, { count: 1 }))
    renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient }))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    apiClient.setAccessToken(null)
    await act(async () => { await vi.advanceTimersByTimeAsync(60_001) })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retains the last good count across malformed, network, and 5xx failures', async () => {
    vi.useFakeTimers()
    fetchMock
      .mockResolvedValueOnce(response(200, { count: 8 }))
      .mockResolvedValueOnce(response(200, { count: 'bad' }))
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(response(500, {}))
    const { result } = renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient: makeApiClient() }))
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await vi.advanceTimersByTimeAsync(5_001) })

    for (let call = 2; call <= 4; call += 1) {
      act(() => window.dispatchEvent(new Event('focus')))
      await act(async () => { await Promise.resolve(); await Promise.resolve() })
      expect(result.current).toEqual({ status: 'error', unreadCount: 8 })
      await act(async () => { await vi.advanceTimersByTimeAsync(5_001) })
      expect(fetchMock).toHaveBeenCalledTimes(call)
    }
  })
})

describe('useUnreadNotifications cancellation and authentication', () => {
  it.each(['unmount', 'user change', 'token change'])('aborts the active request on %s', async (cause) => {
    const pending = deferred<Response>()
    fetchMock.mockReturnValue(pending.promise)
    const apiClient = makeApiClient('token-1')
    const { rerender, unmount } = renderHook(
      ({ userId }) => useUnreadNotifications({ glockeOrigin, userId, apiClient }),
      { initialProps: { userId: 'user-1' as string | null } },
    )
    const signal = (fetchMock.mock.calls[0][1] as RequestInit).signal as AbortSignal

    if (cause === 'unmount') unmount()
    if (cause === 'user change') rerender({ userId: 'user-2' })
    if (cause === 'token change') {
      apiClient.setAccessToken('token-2')
      rerender({ userId: 'user-1' })
    }

    expect(signal.aborted).toBe(true)
  })

  it('ignores a stale response after user and token change even when fetch disregards abort', async () => {
    const oldRequest = deferred<Response>()
    fetchMock
      .mockReturnValueOnce(oldRequest.promise)
      .mockResolvedValueOnce(response(200, { count: 2 }))
    const apiClient = makeApiClient('token-1')
    const { result, rerender } = renderHook(
      ({ userId }) => useUnreadNotifications({ glockeOrigin, userId, apiClient }),
      { initialProps: { userId: 'user-1' } },
    )

    apiClient.setAccessToken('token-2')
    rerender({ userId: 'user-2' })
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', unreadCount: 2 }))
    oldRequest.resolve(response(200, { count: 99 }))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(result.current).toEqual({ status: 'ready', unreadCount: 2 })
  })

  it('discards a queued invalidation when its request generation is replaced', async () => {
    const oldRequest = deferred<Response>()
    fetchMock
      .mockReturnValueOnce(oldRequest.promise)
      .mockResolvedValueOnce(response(200, { count: 2 }))
    const apiClient = makeApiClient('token-1')
    const { result, rerender } = renderHook(
      ({ userId }) => useUnreadNotifications({ glockeOrigin, userId, apiClient }),
      { initialProps: { userId: 'user-1' } },
    )

    act(() => invalidateNotificationUnreadCount())
    rerender({ userId: 'user-2' })
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', unreadCount: 2 }))

    oldRequest.resolve(response(200, { count: 1 }))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not refresh or retry a stale unread 401 after the live token is cleared', async () => {
    const pending = deferred<Response>()
    const apiClient = makeApiClient('expired-token')
    fetchMock.mockReturnValueOnce(pending.promise)
    renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient }))

    apiClient.setAccessToken(null)
    pending.resolve(response(401, {}))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(apiClient.refreshAccessToken).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('on 401 performs one silent same-origin refresh and retries Glocke once without redirecting', async () => {
    const apiClient = makeApiClient('expired-token')
    vi.mocked(apiClient.refreshAccessToken).mockImplementation(async () => {
      apiClient.setAccessToken('fresh-token')
      return 'fresh-token'
    })
    fetchMock
      .mockResolvedValueOnce(response(401, {}))
      .mockResolvedValueOnce(response(200, { count: 6 }))
    const { result } = renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient }))

    await waitFor(() => expect(result.current).toEqual({ status: 'ready', unreadCount: 6 }))
    expect(apiClient.refreshAccessToken).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [retryUrl, retryInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(retryUrl).toBe(unreadUrl)
    expect(new Headers(retryInit.headers).get('Authorization')).toBe('Bearer fresh-token')
    expect(retryInit.credentials).toBe('omit')
  })

  it('does not refresh or retry again when the single post-refresh retry also returns 401', async () => {
    const apiClient = makeApiClient('expired-token')
    vi.mocked(apiClient.refreshAccessToken).mockImplementation(async () => {
      apiClient.setAccessToken('fresh-token')
      return 'fresh-token'
    })
    fetchMock
      .mockResolvedValueOnce(response(401, {}))
      .mockResolvedValueOnce(response(401, {}))
    const { result } = renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient }))

    await waitFor(() => expect(result.current).toEqual({ status: 'error' }))
    expect(apiClient.refreshAccessToken).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('treats a 401 as nonfatal when an older ApiClient has no refreshAccessToken method', async () => {
    const apiClient: ApiClient = makeApiClient('expired-token')
    delete apiClient.refreshAccessToken
    fetchMock.mockResolvedValueOnce(response(401, {}))
    const { result } = renderHook(() => useUnreadNotifications({ glockeOrigin, userId: 'user-1', apiClient }))

    await waitFor(() => expect(result.current).toEqual({ status: 'error' }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
