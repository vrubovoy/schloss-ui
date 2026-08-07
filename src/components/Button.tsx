import { useState, type ButtonHTMLAttributes, type CSSProperties, type FocusEventHandler, type MouseEventHandler } from 'react'
import { useHover } from '../hooks/useHover'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const VARIANT_STYLES: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: 'var(--accent)',
    color: 'var(--text-inverted)',
    border: 'none',
  },
  secondary: {
    background: 'var(--accent-muted)',
    color: 'var(--accent-text)',
    border: 'none',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
  },
  danger: {
    background: 'transparent',
    color: 'var(--danger)',
    border: '1px solid var(--danger)',
  },
}

const VARIANT_HOVER_STYLES: Record<ButtonVariant, CSSProperties> = {
  primary: { background: 'var(--accent-hover)' },
  secondary: { background: 'var(--accent)', color: 'var(--text-inverted)' },
  ghost: { background: 'var(--bg-base)', color: 'var(--text-primary)' },
  danger: { background: 'var(--danger)', color: 'var(--text-inverted)' },
}

function chain(a?: MouseEventHandler<HTMLButtonElement>, b?: MouseEventHandler<HTMLButtonElement>): MouseEventHandler<HTMLButtonElement> {
  return (event) => {
    a?.(event)
    b?.(event)
  }
}

function chainFocus(a: FocusEventHandler<HTMLButtonElement> | undefined, b: FocusEventHandler<HTMLButtonElement>): FocusEventHandler<HTMLButtonElement> {
  return (event) => {
    a?.(event)
    b(event)
  }
}

export function Button({ variant = 'primary', style, onMouseEnter, onMouseLeave, onFocus, onBlur, ...rest }: ButtonProps) {
  const hover = useHover()
  const [focusVisible, setFocusVisible] = useState(false)
  return (
    <button
      type="button"
      {...rest}
      onMouseEnter={chain(onMouseEnter, hover.onMouseEnter)}
      onMouseLeave={chain(onMouseLeave, hover.onMouseLeave)}
      onFocus={chainFocus(onFocus, (event) => setFocusVisible(event.currentTarget.matches(':focus-visible')))}
      onBlur={chainFocus(onBlur, () => setFocusVisible(false))}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        borderRadius: 8,
        padding: '0.5rem 0.9rem',
        fontWeight: 600,
        fontSize: '0.8125rem',
        lineHeight: '1.25rem',
        cursor: 'pointer',
        outline: 'none',
        textDecoration: 'none',
        transition: 'background 150ms, color 150ms',
        ...VARIANT_STYLES[variant],
        ...(hover.hovered ? VARIANT_HOVER_STYLES[variant] : null),
        ...style,
        ...(focusVisible ? { outline: '2px solid var(--text-primary)', outlineOffset: 2 } : null),
      }}
    />
  )
}
