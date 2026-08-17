import { useState, type FocusEvent, type ReactNode } from 'react'
import { Bell, LogOut } from 'lucide-react'
import { useHover } from '../hooks/useHover'

export interface HeaderUser {
  name: string
}

export type HeaderNotificationState =
  | { status: 'loading' }
  | { status: 'ready'; unreadCount: number }
  | { status: 'error'; unreadCount?: number }

export interface HeaderNotifications {
  href: string
  state: HeaderNotificationState
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
} as const

interface AvatarProps {
  user: HeaderUser
  onSettings?: () => void
}

// The avatar doubles as the settings entry point (there is no separate
// gear icon anymore) - a real <button> with a hover ring when onSettings
// is given, a plain non-interactive circle otherwise. `title` stays just
// the person's name either way (useful on its own, since the avatar is
// only ever a single initial); the click action is described separately
// via aria-label so screen readers get both.
function Avatar({ user, onSettings }: AvatarProps) {
  const hover = useHover()

  if (!onSettings) {
    return <div title={user.name} style={AVATAR_STYLE}>{initial(user.name)}</div>
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
      {initial(user.name)}
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
          {user && notifications && <NotificationLink {...notifications} />}
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
