import type { ReactNode } from 'react'

export interface EmptyStateProps {
  /**
   * A line icon (e.g. a lucide-react component instance) - not an emoji.
   * Wrapped in the standard 52x52 accent-tinted circle. Ignored if
   * `illustration` is given.
   */
  icon?: ReactNode
  /**
   * A bigger, custom brand illustration (e.g. a per-service
   * HeroIllustration mascot) rendered in place of the icon+circle -
   * multi-shape illustrations turn to mush at the icon circle's 28px
   * budget, so this flagship empty state gets a proper larger size
   * instead. Takes precedence over `icon` when both are given.
   */
  illustration?: ReactNode
  title: string
  /** One short sentence. */
  description: string
  actionLabel: string
  onAction: () => void
  /** Optional icon rendered before the action button's label. */
  actionIcon?: ReactNode
}

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
}: EmptyStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem', maxWidth: 440, margin: '0 auto' }}>
      {illustration ? (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
          {illustration}
        </div>
      ) : (
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'var(--accent-muted)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
          }}
        >
          {icon}
        </div>
      )}
      <h2
        style={{
          margin: '0 0 0.5rem',
          color: 'var(--text-primary)',
          fontSize: '1.125rem',
          fontWeight: 600,
        }}
      >
        {title}
      </h2>
      <p style={{ margin: '0 0 1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        {description}
      </p>
      <button
        type="button"
        onClick={onAction}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'var(--accent)',
          color: 'var(--text-inverted)',
          borderRadius: 'var(--radius-md)',
          padding: '0.5rem 1rem',
          fontWeight: 500,
          fontSize: '0.875rem',
          lineHeight: '1.25rem',
          cursor: 'pointer',
          border: 'none',
          outline: 'none',
        }}
      >
        {actionIcon}
        {actionLabel}
      </button>
    </div>
  )
}
