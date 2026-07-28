export interface FooterProps {
  /** e.g. "Schloss", "Schlüssel", "Kuvert" - rendered as "{serviceName} — открытый код, свой хостинг". */
  serviceName: string
  /** One short sentence describing what this service does, e.g. "конвертное бюджетирование" - shown as its own line above the tagline. Omit for no description line at all. */
  description?: string
  /** e.g. "1.4.0" (no leading "v") - the consuming app's own package.json version, shown as "· v1.4.0". Omit if the caller has no version to report. */
  version?: string
  /** Link to this app's own plain-language user guide, e.g. "/help". Omit to render no help link at all. */
  helpHref?: string
  /** Link text for helpHref. Defaults to "Как пользоваться". */
  helpLabel?: string
}

export function Footer({ serviceName, description, version, helpHref, helpLabel = 'Как пользоваться' }: FooterProps) {
  return (
    <footer
      style={{
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.375rem',
        borderTop: '1px solid var(--border)',
        color: 'var(--text-muted)',
        fontSize: '0.75rem',
      }}
    >
      {description && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4375rem' }}>
          <span
            aria-hidden="true"
            style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }}
          />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8125rem', letterSpacing: '-0.01em' }}>
            {description}
          </span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span>
          {serviceName} — открытый код, свой хостинг
          {version && ` · v${version}`}
        </span>
        {helpHref && (
          <a href={helpHref} style={{ color: 'var(--text-muted)' }}>
            {helpLabel}
          </a>
        )}
        <a
          href="https://github.com/zudaR107"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
          style={{ display: 'flex', color: 'var(--text-muted)' }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
      </div>
    </footer>
  )
}
