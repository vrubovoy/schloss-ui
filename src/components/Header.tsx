import { useEffect, useRef, useState, type FocusEvent, type ReactNode } from 'react'
import { Bell, LogOut } from 'lucide-react'
import { useHover } from '../hooks/useHover'
import type { ApiClient } from '../auth/apiClient'
import { NotificationDropdown } from './NotificationDropdown'
import { NotificationToast } from './NotificationToast'
import { authedFetch, fetchRecentNotifications, resolveActionUrl, type RecentNotification } from '../lib/notificationFetch'
import { invalidateNotificationUnreadCount } from '../hooks/useUnreadNotifications'

export interface HeaderUser {
  name: string
  /** A ready-to-render image source (typically a data: URL from
   * useAvatarUrl) - omit or pass null to keep the initial-letter avatar. */
  avatarUrl?: string | null
}

export type HeaderNotificationState =
  | { status: 'loading' }
  | { status: 'ready'; unreadCount: number }
  | { status: 'error'; unreadCount?: number }

export interface HeaderNotifications {
  href: string
  state: HeaderNotificationState
  /** Glocke's public origin and this app's own apiClient - both already
   * computed by whatever called useUnreadNotifications to produce `state`
   * above. Powers the hover/focus preview dropdown's own on-demand fetch;
   * omit to keep the bell link-only (no dropdown) for a caller that
   * hasn't wired these up. */
  glockeOrigin?: string
  apiClient?: ApiClient
}

export interface HeaderProps {
  /** The service's own brand mark, rendered inside the accent-colored badge. */
  logo: ReactNode
  /** Where the logo/badge links to - the logo slot is itself the home link. */
  homeHref: string
  /** Tooltip on the home link. */
  homeTitle?: string
  user?: HeaderUser | null
  onSettings?: () => void
  onLogout?: () => void
  /** Anything service-specific rendered before the icon group, e.g. a mobile nav toggle. */
  leftSlot?: ReactNode
  /** Anything service-specific rendered before settings/logout/avatar, e.g. a theme toggle. */
  rightSlot?: ReactNode
  /** Controlled notification destination and unread state. Only shown for a user. */
  notifications?: HeaderNotifications
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase()
}

interface HeaderIconButtonProps {
  onClick: () => void
  title: string
  children: ReactNode
}

function HeaderIconButton({ onClick, title, children }: HeaderIconButtonProps) {
  const hover = useHover()
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      onMouseEnter={hover.onMouseEnter}
      onMouseLeave={hover.onMouseLeave}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover.hovered ? 'var(--bg-base)' : 'none',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        color: hover.hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        padding: 4,
        transition: 'background 150ms, color 150ms',
      }}
    >
      {children}
    </button>
  )
}

function notificationLabel(state: HeaderNotificationState): string {
  if (state.status === 'loading') return 'Уведомления: загрузка числа непрочитанных'
  if (state.status === 'error' && state.unreadCount === undefined) {
    return 'Уведомления: число непрочитанных недоступно'
  }

  const count = state.unreadCount
  const countLabel = count === 0
    ? 'Уведомления: непрочитанных нет'
    : `Уведомления: непрочитанных — ${count}`
  return state.status === 'error' ? `${countLabel}, данные могут быть устаревшими` : countLabel
}

function NotificationLink({ href, state }: HeaderNotifications) {
  const [focusVisible, setFocusVisible] = useState(false)
  const count = state.status === 'loading' ? undefined : state.unreadCount
  const showBadge = count !== undefined && count > 0
  const statusColor = state.status === 'error' ? 'var(--danger)' : 'var(--accent)'

  function handleFocus(event: FocusEvent<HTMLAnchorElement>) {
    setFocusVisible(event.currentTarget.matches(':focus-visible'))
  }

  return (
    <a
      href={href}
      aria-label={notificationLabel(state)}
      onFocus={handleFocus}
      onBlur={() => setFocusVisible(false)}
      style={{
        width: 32,
        height: 32,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        borderRadius: 'var(--radius-sm)',
        color: state.status === 'error' ? 'var(--danger)' : 'var(--text-secondary)',
        textDecoration: 'none',
        outline: focusVisible ? '2px solid var(--text-primary)' : '2px solid transparent',
        outlineOffset: 2,
        transition: 'background 150ms, color 150ms, outline-color 150ms',
      }}
    >
      <Bell size={16} strokeWidth={2} aria-hidden="true" />
      {showBadge && (
        <span
          data-notification-badge=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -3,
            right: -5,
            minWidth: 16,
            height: 16,
            padding: '0 3px',
            boxSizing: 'border-box',
            borderRadius: 8,
            background: statusColor,
            color: 'var(--text-inverted, #fff)',
            border: '2px solid var(--bg-surface)',
            fontSize: '0.625rem',
            fontWeight: 700,
            lineHeight: '12px',
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
      {(state.status === 'loading' || (state.status === 'error' && count === undefined)) && (
        <span
          data-notification-status={state.status}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 3,
            right: 3,
            width: 6,
            height: 6,
            boxSizing: 'border-box',
            borderRadius: '50%',
            background: state.status === 'loading' ? 'transparent' : statusColor,
            border: state.status === 'loading' ? `1px solid ${statusColor}` : 'none',
          }}
        />
      )}
    </a>
  )
}

// Wraps the bell link with the hover/focus-triggered recent-notifications
// preview. Kept separate from NotificationLink itself so a caller that
// hasn't wired glockeOrigin/apiClient (see HeaderNotifications) still gets
// a plain link-only bell, unchanged from before this dropdown existed.
function NotificationBell(props: HeaderNotifications) {
  const [open, setOpen] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function openNow() {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null }
    setOpen(true)
  }
  // A short delay (rather than closing instantly on mouseleave) survives
  // the small gap between the bell icon and the dropdown panel below it -
  // without it, moving the pointer diagonally from the bell into the
  // panel can register as having left the wrapper first.
  function closeSoon() {
    closeTimerRef.current = setTimeout(() => setOpen(false), 150)
  }

  // A document-level listener (not onKeyDown on the wrapper) so Escape
  // closes the dropdown even when it was opened by hover alone - a mouse
  // hover never moves keyboard focus, so a keydown fired from wherever
  // focus actually is (usually document.body) would never bubble through
  // a handler scoped to this wrapper.
  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const [toastQueue, setToastQueue] = useState<RecentNotification[]>([])
  const seenUnreadCountRef = useRef<number | null>(null)
  const glockeOrigin = props.glockeOrigin
  const apiClient = props.apiClient

  // Pops up a toast for each newly-arrived unread notification (not just
  // a badge-count bump) - detected as unreadCount increasing since the
  // last check. The FIRST ready state only records the baseline without
  // toasting, so a page load with pre-existing unread notifications
  // doesn't fire a burst of "new" toasts for old ones.
  useEffect(() => {
    if (!glockeOrigin || !apiClient) return
    if (props.state.status !== 'ready') return
    const count = props.state.unreadCount
    const previous = seenUnreadCountRef.current
    seenUnreadCountRef.current = count
    if (previous === null || count <= previous) return

    const controller = new AbortController()
    void fetchRecentNotifications(glockeOrigin, apiClient, Math.min(count - previous, 5), controller.signal)
      .then((items) => {
        if (!items) return
        setToastQueue((queue) => [...queue, ...items.filter((item) => !item.readAt)])
      })
      .catch(() => {})
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the unread count itself should re-trigger this, not every state object identity change
  }, [props.state.status === 'ready' ? props.state.unreadCount : null, glockeOrigin, apiClient])

  function dismissFrontToast() {
    setToastQueue((queue) => queue.slice(1))
  }

  function openFrontToast() {
    const toast = toastQueue[0]
    dismissFrontToast()
    if (!toast || !glockeOrigin || !apiClient) return
    void authedFetch(glockeOrigin, apiClient, `/backend/notifications/${toast.id}/read`, { method: 'POST' }, new AbortController().signal)
      .then(() => invalidateNotificationUnreadCount())
      .catch(() => {})
    window.location.href = resolveActionUrl(toast.actionUrl, glockeOrigin, props.href)
  }

  if (!props.glockeOrigin || !props.apiClient) return <NotificationLink {...props} />

  return (
    <>
      <div
        style={{ position: 'relative' }}
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
        onFocus={openNow}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false) }}
      >
        <NotificationLink {...props} />
        {open && (
          <NotificationDropdown
            open={open}
            glockeOrigin={props.glockeOrigin}
            apiClient={props.apiClient}
            notificationsHref={props.href}
          />
        )}
      </div>
      {/* Rendered as a sibling, not nested inside the hover/focus wrapper
       * above: NotificationToast portals to document.body, but React
       * still bubbles its synthetic events through its REACT-tree
       * ancestors regardless of DOM position - nested here, clicking the
       * toast would trigger the wrapper's onFocus and spuriously open the
       * dropdown too. */}
      {toastQueue[0] && (
        <NotificationToast
          key={toastQueue[0].id}
          title={toastQueue[0].title}
          body={toastQueue[0].body}
          onOpen={openFrontToast}
          onDismiss={dismissFrontToast}
        />
      )}
    </>
  )
}

const AVATAR_STYLE = {
  width: 28,
  height: 28,
  flexShrink: 0,
  borderRadius: '50%',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: '0.75rem',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
} as const

interface AvatarProps {
  user: HeaderUser
  onSettings?: () => void
}

// The avatar doubles as the settings entry point (there is no separate
// gear icon anymore) - a real <button> with a hover ring when onSettings
// is given, a plain non-interactive circle otherwise. `title` stays just
// the person's name either way; the click action is described separately
// via aria-label so screen readers get both.
function AvatarContent({ user }: { user: HeaderUser }) {
  const [failed, setFailed] = useState(false)
  // Retry a new avatarUrl (e.g. after a fresh upload) even if an earlier
  // one failed to load.
  useEffect(() => setFailed(false), [user.avatarUrl])

  if (user.avatarUrl && !failed) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    )
  }
  return <>{initial(user.name)}</>
}

function Avatar({ user, onSettings }: AvatarProps) {
  const hover = useHover()

  if (!onSettings) {
    return <div title={user.name} style={AVATAR_STYLE}><AvatarContent user={user} /></div>
  }

  return (
    <button
      type="button"
      onClick={onSettings}
      title={user.name}
      aria-label="Настройки аккаунта"
      onMouseEnter={hover.onMouseEnter}
      onMouseLeave={hover.onMouseLeave}
      style={{
        ...AVATAR_STYLE,
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        boxShadow: hover.hovered ? '0 0 0 2px var(--bg-surface), 0 0 0 4px var(--accent)' : 'none',
        transition: 'box-shadow 150ms',
      }}
    >
      <AvatarContent user={user} />
    </button>
  )
}

export function Header({
  logo,
  homeHref,
  homeTitle = 'На главную',
  user,
  onSettings,
  onLogout,
  leftSlot,
  rightSlot,
  notifications,
}: HeaderProps) {
  return (
    <header
      style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0 clamp(0.75rem, 3vw, 1.5rem)',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: 'var(--shadow-sm)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        gap: 'clamp(0.5rem, 2vw, 0.75rem)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(0.5rem, 2vw, 0.75rem)', minWidth: 0 }}>
        {leftSlot}
        <a
          href={homeHref}
          title={homeTitle}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            flexShrink: 0,
            background: 'var(--accent)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {logo}
        </a>
      </div>

      {(user || rightSlot) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(0.375rem, 1.5vw, 0.625rem)', minWidth: 0 }}>
          {rightSlot}
          {user && notifications && <NotificationBell {...notifications} />}
          {user && onLogout && (
            <HeaderIconButton onClick={onLogout} title="Выйти">
              <LogOut size={16} strokeWidth={2} />
            </HeaderIconButton>
          )}
          {user && <Avatar user={user} onSettings={onSettings} />}
        </div>
      )}
    </header>
  )
}
