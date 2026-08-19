import { useEffect, useRef, useState } from 'react'
import { CheckCheck } from 'lucide-react'
import type { ApiClient } from '../auth/apiClient'
import { invalidateNotificationUnreadCount } from '../hooks/useUnreadNotifications'
import { authedFetch, fetchRecentNotifications, resolveActionUrl, type RecentNotification } from '../lib/notificationFetch'

export type { RecentNotification }

const RECENT_LIMIT = 5

type DropdownState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; items: RecentNotification[] }

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000))
  if (minutes < 1) return 'только что'
  if (minutes < 60) return `${minutes} мин назад`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} ч назад`
  const days = Math.round(hours / 24)
  return `${days} дн назад`
}

export interface NotificationDropdownProps {
  open: boolean
  glockeOrigin: string
  apiClient: ApiClient
  notificationsHref: string
}

/** Recent-notifications preview shown under the header bell on hover/focus
 * - fetched fresh each time it opens (not polled), lets the unread list be
 * scanned and cleared without navigating into Glocke itself. */
export function NotificationDropdown({ open, glockeOrigin, apiClient, notificationsHref }: NotificationDropdownProps) {
  const [state, setState] = useState<DropdownState>({ status: 'loading' })
  const clearingRef = useRef(false)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    let active = true
    setState({ status: 'loading' })
    void (async () => {
      try {
        const items = await fetchRecentNotifications(glockeOrigin, apiClient, RECENT_LIMIT, controller.signal)
        if (!active) return
        if (!items) { setState({ status: 'error' }); return }
        setState({ status: 'ready', items })
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === 'AbortError')) setState({ status: 'error' })
      }
    })()
    return () => { active = false; controller.abort() }
  }, [open, glockeOrigin, apiClient])

  async function markRead(id: string) {
    if (state.status !== 'ready') return
    setState({ status: 'ready', items: state.items.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item) })
    try {
      await authedFetch(glockeOrigin, apiClient, `/backend/notifications/${id}/read`, { method: 'POST' }, new AbortController().signal)
      invalidateNotificationUnreadCount()
    } catch {
      // Local optimistic state already reflects "read" - the next open
      // re-fetches the real state, so a failed request here just means a
      // stale badge count until then rather than a broken dropdown.
    }
  }

  function handleItemClick(item: RecentNotification) {
    if (!item.readAt) void markRead(item.id)
    window.location.href = resolveActionUrl(item.actionUrl, glockeOrigin, notificationsHref)
  }

  async function handleClearAll() {
    if (clearingRef.current) return
    clearingRef.current = true
    setClearing(true)
    try {
      await authedFetch(glockeOrigin, apiClient, '/backend/notifications/read-all', { method: 'POST' }, new AbortController().signal)
      if (state.status === 'ready') {
        const readAt = new Date().toISOString()
        setState({ status: 'ready', items: state.items.map((item) => item.readAt ? item : { ...item, readAt }) })
      }
      invalidateNotificationUnreadCount()
    } catch {
      // Leave the list as-is; the badge/dropdown will reconcile on next open.
    } finally {
      clearingRef.current = false
      setClearing(false)
    }
  }

  const hasUnread = state.status === 'ready' && state.items.some((item) => !item.readAt)

  return (
    <div
      role="menu"
      aria-label="Последние уведомления"
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: 320,
        maxWidth: 'calc(100vw - 1.5rem)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        zIndex: 40,
        overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.625rem 0.875rem', borderBottom: '1px solid var(--border)',
      }}>
        <strong style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Уведомления</strong>
        {hasUnread && (
          <button
            type="button"
            onClick={() => void handleClearAll()}
            disabled={clearing}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: clearing ? 'default' : 'pointer',
              color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 600, padding: 0,
            }}
          >
            <CheckCheck size={13} />Прочитать все
          </button>
        )}
      </div>

      {state.status === 'loading' && (
        <div style={{ padding: '1.25rem', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Загрузка…
        </div>
      )}
      {state.status === 'error' && (
        <div style={{ padding: '1.25rem', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Не удалось загрузить уведомления.
        </div>
      )}
      {state.status === 'ready' && state.items.length === 0 && (
        <div style={{ padding: '1.25rem', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Уведомлений пока нет
        </div>
      )}
      {state.status === 'ready' && state.items.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 340, overflowY: 'auto' }}>
          {state.items.map((item) => (
            <li key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleItemClick(item)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', background: item.readAt ? 'none' : 'var(--accent-muted)',
                  border: 'none', cursor: 'pointer', padding: '0.625rem 0.875rem', color: 'var(--text-primary)',
                }}
              >
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 2 }}>{item.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>{item.body}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{formatRelative(item.createdAt)}</div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <a
        href={notificationsHref}
        style={{
          display: 'block', textAlign: 'center', padding: '0.625rem', fontSize: '0.75rem', fontWeight: 600,
          color: 'var(--accent)', textDecoration: 'none', borderTop: '1px solid var(--border)',
        }}
      >
        Все уведомления
      </a>
    </div>
  )
}
