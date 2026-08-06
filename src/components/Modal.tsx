import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button, type ButtonVariant } from './Button'
import { useHover } from '../hooks/useHover'

export interface ModalAction {
  label: string
  onClick: () => void
  variant?: ButtonVariant
}

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  /** Optional icon badge tying the dialog to its context, e.g. a wallet icon for "Новый счёт". */
  icon?: ReactNode
  children: ReactNode
  /** Rendered right-aligned; put the primary action last so it's rightmost. */
  actions?: ModalAction[]
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function CloseButton({ onClick }: { onClick: () => void }) {
  const hover = useHover()
  return (
    <button
      type="button"
      onClick={onClick}
      title="Закрыть"
      aria-label="Закрыть"
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
        padding: 6,
        transition: 'background 150ms, color 150ms',
      }}
    >
      <X size={16} strokeWidth={2} />
    </button>
  )
}

export function Modal({ open, onClose, title, icon, children, actions }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    const initialFocus = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? dialog
    initialFocus?.focus()

    return () => previousFocus?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key === 'Tab') {
        const dialog = dialogRef.current
        if (!dialog) return
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = document.activeElement
        if (!first || !last) {
          event.preventDefault()
          dialog.focus()
        } else if (event.shiftKey && (active === first || !dialog.contains(active))) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
          event.preventDefault()
          first.focus()
        }
        return
      }
      // The Save/Cancel buttons live outside the <form> (children render
      // it, actions render as siblings) so pages control button placement
      // - but that means the browser's native implicit-submission (Enter
      // in a field submits the nearest form) never fires: it requires
      // either exactly one text field or a real submit button inside the
      // form, neither of which is true here. Trigger the primary action
      // (the last entry, by convention - see ModalProps.actions) instead,
      // same as clicking it.
      if (event.key === 'Enter' && actions && actions.length > 0) {
        const target = event.target
        if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) {
          event.preventDefault()
          actions[actions.length - 1]!.onClick()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, actions])

  if (!open) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{
          width: '100%',
          maxWidth: 420,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.5rem',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            {icon && (
              <div
                style={{
                  width: 26,
                  height: 26,
                  flexShrink: 0,
                  borderRadius: 7,
                  background: 'var(--accent-muted)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {icon}
              </div>
            )}
            <h2 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {title}
            </h2>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {children}

        {actions && actions.length > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.5rem',
              marginTop: '1.5rem',
            }}
          >
            {actions.map((action) => (
              <Button key={action.label} variant={action.variant ?? 'ghost'} onClick={action.onClick}>
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
