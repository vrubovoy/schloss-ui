import { useId, useRef, type ReactNode } from 'react'
import { Download } from 'lucide-react'
import { ICON_SIZE } from '../iconSize'
import { Button } from './Button'

export interface DirectExportActionProps {
  title: string
  description: string
  actionLabel: string
  loadingLabel: string
  onExport: () => void | Promise<void>
  loading?: boolean
  error?: string | null
  /** Optional leading icon (e.g. lucide-react at ICON_SIZE.illustrative-ish
   * 24px), rendered beside the title/description the same way host apps'
   * own icon-prefixed info cards do - lets this card sit flush with
   * sibling cards that have one, instead of sitting visibly further left. */
  icon?: ReactNode
}

export function DirectExportAction({
  title,
  description,
  actionLabel,
  loadingLabel,
  onExport,
  loading = false,
  error,
  icon,
}: DirectExportActionProps) {
  const titleId = useId()
  const exportingRef = useRef(false)

  function handleExport() {
    if (loading || exportingRef.current) return

    exportingRef.current = true
    try {
      const result = onExport()
      Promise.resolve(result).then(
        () => { exportingRef.current = false },
        () => { exportingRef.current = false },
      )
    } catch (error) {
      queueMicrotask(() => { exportingRef.current = false })
      throw error
    }
  }

  const body = (
    <>
      <h2
        id={titleId}
        style={{
          margin: '0 0 0.25rem',
          color: 'var(--text-primary)',
          fontSize: '0.875rem',
          fontWeight: 700,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: '0 0 1rem',
          color: 'var(--text-secondary)',
          fontSize: '0.8125rem',
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
      <Button
        variant="secondary"
        disabled={loading}
        onClick={handleExport}
        style={loading ? { cursor: 'not-allowed', opacity: 0.7 } : undefined}
      >
        <Download aria-hidden="true" size={ICON_SIZE.default} strokeWidth={2} />
        {loading ? loadingLabel : actionLabel}
      </Button>
      {error && (
        <p
          role="alert"
          aria-live="assertive"
          style={{
            margin: '0.75rem 0 0',
            color: 'var(--danger)',
            fontSize: '0.8125rem',
          }}
        >
          {error}
        </p>
      )}
    </>
  )

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={loading}
      style={{
        padding: '1.5rem',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        ...(icon ? { display: 'flex', gap: '1rem' } : null),
      }}
    >
      {icon && <span aria-hidden="true" style={{ flex: 'none', color: 'var(--accent)', display: 'flex' }}>{icon}</span>}
      {icon ? <div style={{ flex: 1, minWidth: 0 }}>{body}</div> : body}
    </section>
  )
}
