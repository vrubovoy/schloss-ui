import { useRef, useState } from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Field, type FieldInputProps } from './Field'
import { Calendar } from './Calendar'
import { CalendarPopover } from './CalendarPopover'
import { formatDisplayDate, parseISODate, type WeekStartsOn } from '../lib/dateUtils'
import type { DateFormat } from '../lib/dateFormat'

export interface DateFieldProps extends Omit<FieldInputProps, 'type' | 'value' | 'onChange' | 'as' | 'readOnly'> {
  /** ISO yyyy-mm-dd, '' = unset. */
  value: string
  onChange: (value: string) => void
  /** Profile display preference. Defaults to DMY when omitted or null. */
  dateFormat?: DateFormat | null
  /** Profile week preference: 0 = Sunday, 1 = Monday (default). */
  weekStartsOn?: WeekStartsOn | null
}

export function DateField({ value, onChange, dateFormat, weekStartsOn, style, ...rest }: DateFieldProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  function handleDayClick(iso: string) {
    onChange(iso)
    setOpen(false)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <Field
        {...rest}
        type="text"
        inputMode="none"
        readOnly
        value={value ? formatDisplayDate(value, dateFormat) : ''}
        placeholder="Выберите дату"
        onClick={() => setOpen((o) => !o)}
        suffix={<CalendarIcon size={16} />}
        style={{ cursor: 'pointer', ...style }}
      />
      <CalendarPopover open={open} onClose={() => setOpen(false)} anchorRef={containerRef}>
        <Calendar
          initialMonth={parseISODate(value) ?? new Date()}
          start={value}
          end=""
          hoverEnd={null}
          weekStartsOn={weekStartsOn}
          onDayClick={handleDayClick}
          onDayHover={() => {}}
        />
      </CalendarPopover>
    </div>
  )
}
