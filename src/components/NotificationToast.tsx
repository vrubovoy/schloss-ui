import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Bell, X } from 'lucide-react'

export interface NotificationToastProps {
  title: string
  body: string
  onOpen: () => void
  onDismiss: () => void
  /** Auto-dismiss delay in ms. Pass 0 to disable auto-dismiss. */
  duration?: number
}

/** A single "new notification" pop-up, distinct from Toast (which is a
 * generic success/error action-feedback banner) - this carries a
 * title+body and opens the notification on click rather than just
 * confirming an action just taken. Shown one at a time by the caller
 * (see Header.tsx's toast queue) rather than stacking several with
 * independent timers. */
export function NotificationToast({ title, body, onOpen, onDismiss, duration = 6000 }: NotificationToastProps) {
  // onDismiss kept in a ref, not the effect's own dependency array, so a
  // parent re-render that hands down a new onDismiss reference (e.g. from
  // an inline arrow function) can't restart this timer from zero - only
  // an actual title/body change (a genuinely different toast) should do
  // that, and remounting via `key` in Header.tsx already handles that.
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (duration === 0) return
    const timer = setTimeout(() => onDismissRef.current(), duration)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately NOT depending on onDismiss, see comment above
  }, [duration])

  return createPortal(
    <div
      role="status"
      style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 100,
        width: 320,
        maxWidth: 'calc(100vw - 2rem)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.625rem',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        padding: '0.75rem 0.875rem',
      }}
    >
      <span style={{
        flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
        background: 'var(--accent-muted)', color: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Bell size={14} aria-hidden="true" />
      </span>
      <button
        type="button"
        onClick={onOpen}
        style={{
          flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--text-primary)', padding: 0,
        }}
      >
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{body}</div>
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Закрыть уведомление"
        style={{
          flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', padding: 2, display: 'flex',
        }}
      >
        <X size={14} />
      </button>
    </div>,
    document.body,
  )
}
