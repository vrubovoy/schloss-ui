import type { ReactNode } from 'react'

export interface StatTileProps {
  label: string
  value: ReactNode
  /** Colors the value --accent instead of the default --text-primary. */
  accent?: boolean
}

export function StatTile({ label, value, accent = false }: StatTileProps) {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '0.875rem 1rem',
      }}
    >
      <div
        style={{
          fontSize: '0.6875rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--text-muted)',
          marginBottom: '0.25rem',
          // Reserves space for two lines regardless of whether this
          // particular label wraps - without it, a longer label (e.g.
          // "Инвайты в ожидании") wrapping to two lines pushes its own
          // value down relative to the single-line labels beside it in
          // the same StatTile row, breaking the row of numbers' shared
          // baseline.
          lineHeight: '0.875rem',
          minHeight: '1.75rem',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '1.0625rem',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: accent ? 'var(--accent)' : 'var(--text-primary)',
        }}
      >
        {value}
      </div>
    </div>
  )
}
