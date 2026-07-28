import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

interface FieldSharedProps {
  label: string
  error?: string
  /** For currency symbols on amount fields, rendered inline before the input. */
  prefix?: ReactNode
  /** For an interactive control (e.g. a password visibility toggle), rendered inline after the input. Unlike prefix, receives pointer events. */
  suffix?: ReactNode
}

export type FieldInputProps = FieldSharedProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> & { as?: 'input' }

export type FieldSelectProps = FieldSharedProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'prefix'> & { as: 'select' }

export type FieldProps = FieldInputProps | FieldSelectProps

// paddingLeft/paddingRight are deliberately not part of this shared
// shorthand-free base - InputField/SelectField always compute both as
// concrete values (never omitted/undefined). Mixing the "padding"
// shorthand with "paddingLeft"/"paddingRight" longhands in the same
// conditionally-computed style object is exactly the shorthand/longhand
// conflict React warns about ("can lead to unexpected results") - it
// silently produced too little left padding on every field in practice.
const fieldBoxStyle = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  paddingTop: '0.5rem',
  paddingBottom: '0.5rem',
  fontSize: '0.875rem',
  color: 'var(--text-primary)',
  outline: 'none',
  width: '100%',
  fontFamily: 'var(--font-sans)',
  transition: 'border-color 150ms, box-shadow 150ms',
} as const

const focusRingStyle = {
  border: '1px solid var(--accent)',
  boxShadow: '0 0 0 3px var(--accent-muted)',
} as const

// A red border alone (no shadow) when an errored field isn't focused -
// the shadow only appears on focus, matching focusRingStyle's own
// restraint, so a page with several errored fields doesn't turn into a
// wall of glowing boxes.
const errorBorderStyle = {
  border: '1px solid var(--danger)',
} as const

const errorFocusRingStyle = {
  border: '1px solid var(--danger)',
  boxShadow: '0 0 0 3px var(--danger-muted)',
} as const

function borderStyle(error: string | undefined, focused: boolean) {
  if (error) return focused ? errorFocusRingStyle : errorBorderStyle
  return focused ? focusRingStyle : null
}

function FieldLabel({ htmlFor, label }: { htmlFor: string; label: string }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: 'block',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'var(--text-secondary)',
        marginBottom: '0.375rem',
      }}
    >
      {label}
    </label>
  )
}

function FieldPrefix({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        position: 'absolute',
        left: '0.75rem',
        top: '50%',
        transform: 'translateY(-50%)',
        color: 'var(--text-muted)',
        fontSize: '0.875rem',
        pointerEvents: 'none',
      }}
    >
      {children}
    </span>
  )
}

function FieldSuffix({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        position: 'absolute',
        right: '0.75rem',
        top: '50%',
        transform: 'translateY(-50%)',
        color: 'var(--text-muted)',
        fontSize: '0.875rem',
      }}
    >
      {children}
    </span>
  )
}

function FieldError({ children }: { children: ReactNode }) {
  return (
    <p style={{ margin: '0.375rem 0 0', fontSize: '0.75rem', color: 'var(--danger)' }}>
      {children}
    </p>
  )
}

function InputField({ label, error, prefix, suffix, id, style, onFocus, onBlur, ...rest }: FieldInputProps) {
  const [focused, setFocused] = useState(false)
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <div>
      <FieldLabel htmlFor={fieldId} label={label} />
      <div style={{ position: 'relative' }}>
        {prefix && <FieldPrefix>{prefix}</FieldPrefix>}
        <input
          {...rest}
          id={fieldId}
          aria-invalid={!!error}
          onFocus={(event) => {
            setFocused(true)
            onFocus?.(event)
          }}
          onBlur={(event) => {
            setFocused(false)
            onBlur?.(event)
          }}
          style={{
            ...fieldBoxStyle,
            paddingLeft: prefix ? '1.75rem' : '0.75rem',
            paddingRight: suffix ? '2.25rem' : '0.75rem',
            ...borderStyle(error, focused),
            ...style,
          }}
        />
        {suffix && <FieldSuffix>{suffix}</FieldSuffix>}
      </div>
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}

function SelectField({ label, error, prefix, suffix, id, style, onFocus, onBlur, ...rest }: FieldSelectProps) {
  const [focused, setFocused] = useState(false)
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <div>
      <FieldLabel htmlFor={fieldId} label={label} />
      <div style={{ position: 'relative' }}>
        {prefix && <FieldPrefix>{prefix}</FieldPrefix>}
        <select
          {...rest}
          id={fieldId}
          aria-invalid={!!error}
          onFocus={(event) => {
            setFocused(true)
            onFocus?.(event)
          }}
          onBlur={(event) => {
            setFocused(false)
            onBlur?.(event)
          }}
          style={{
            ...fieldBoxStyle,
            appearance: 'none',
            paddingLeft: prefix ? '1.75rem' : '0.75rem',
            paddingRight: suffix ? '2.25rem' : '2rem',
            cursor: 'pointer',
            ...borderStyle(error, focused),
            ...style,
          }}
        />
        {suffix ? (
          <FieldSuffix>{suffix}</FieldSuffix>
        ) : (
          <ChevronDown
            size={16}
            strokeWidth={2}
            style={{
              position: 'absolute',
              right: '0.65rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}

export function Field(props: FieldProps) {
  if (props.as === 'select') return <SelectField {...props} />
  return <InputField {...props} />
}
