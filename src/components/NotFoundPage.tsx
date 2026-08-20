import type { ReactNode } from 'react'

export interface NotFoundPageProps {
  /**
   * Per-service mascot, e.g. `<HeroIllustration size={100} />`. Wrapped in
   * the same accent-muted badge as EmptyState's own `illustration` prop, so
   * a 404 page feels like part of the same visual family as the app's
   * empty states. Services with no mascot of their own (e.g. Glocke) can
   * omit this - a plain "404" numeral is shown instead.
   */
  illustration?: ReactNode
  title?: string
  description?: string
  /** e.g. "/" */
  homeHref: string
  homeLabel?: string
}

export function NotFoundPage({
  illustration,
  title = 'Страница не найдена',
  description = 'Такой страницы не существует, либо она была перемещена.',
  homeHref,
  homeLabel = 'На главную',
}: NotFoundPageProps) {
  return (
    <div style={{
      textAlign: 'center', padding: '4rem 2rem', maxWidth: 440, margin: '0 auto',
      minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center',
    }}>
      {illustration ? (
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: '1.5rem', borderRadius: 'var(--radius-lg)', background: 'var(--accent-muted)', margin: '0 auto 1.25rem',
        }}>
          {illustration}
        </div>
      ) : (
        <div style={{
          margin: '0 auto 1rem', color: 'var(--accent)', fontSize: '3rem', fontWeight: 700, lineHeight: 1,
        }}>
          404
        </div>
      )}
      <h1 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)', fontSize: '1.125rem', fontWeight: 600 }}>
        {title}
      </h1>
      <p style={{ margin: '0 0 1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        {description}
      </p>
      <a href={homeHref} style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent)', color: 'var(--text-inverted)',
        borderRadius: 'var(--radius-md)', padding: '0.5rem 1rem', fontWeight: 500, fontSize: '0.875rem', lineHeight: '1.25rem',
        textDecoration: 'none',
      }}>
        {homeLabel}
      </a>
    </div>
  )
}
