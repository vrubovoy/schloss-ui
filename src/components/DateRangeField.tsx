import { useRef, useState } from 'react'
import { CalendarRange } from 'lucide-react'
import { Field, type FieldInputProps } from './Field'
import { Calendar } from './Calendar'
import { CalendarPopover } from './CalendarPopover'
import { formatDisplayDate, parseISODate, type WeekStartsOn } from '../lib/dateUtils'
import type { DateFormat } from '../lib/dateFormat'

export interface DateRangeFieldProps extends Omit<FieldInputProps, 'type' | 'value' | 'onChange' | 'as' | 'readOnly'> {
  /** ISO yyyy-mm-dd, '' = unset. Two plain strings (not a nested object)
   * to match the flat startDate/endDate shape most consumers already use. */
  start: string
  end: string
  onChange: (start: string, end: string) => void
  /** Profile display preference. Defaults to DMY when omitted or null. */
  dateFormat?: DateFormat | null
  /** Profile week preference: 0 = Sunday, 1 = Monday (default). */
  weekStartsOn?: WeekStartsOn | null
}

export function DateRangeField({
  start, end, onChange, dateFormat, weekStartsOn, style, ...rest
}: DateRangeFieldProps) {
  const [open, setOpen] = useState(false)
  const [hoverEnd, setHoverEnd] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  function handleDayClick(iso: string) {
    setHoverEnd(null)

    if (!start) {
      onChange(iso, '')
      return
    }
    if (!end) {
      // Clicking the same day twice makes a same-day range; clicking an
      // earlier day than `start` swaps so start/end stay chronological.
      onChange(iso < start ? iso : start, iso < start ? start : iso)
      setOpen(false)
      return
    }
    // Both already set - the third click restarts a fresh selection.
    onChange(iso, '')
  }

  const displayValue = start && end
    ? `${formatDisplayDate(start, dateFormat)} – ${formatDisplayDate(end, dateFormat)}`
    : ''

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <Field
        {...rest}
        type="text"
        inputMode="none"
        readOnly
        value={displayValue}
        placeholder="Выберите период"
        onClick={() => setOpen((o) => !o)}
        suffix={<CalendarRange size={16} />}
        style={{ cursor: 'pointer', ...style }}
      />
      <CalendarPopover
        open={open}
        onClose={() => { setOpen(false); setHoverEnd(null) }}
        anchorRef={containerRef}
      >
        <Calendar
          initialMonth={parseISODate(start) ?? new Date()}
          start={start}
          end={end}
          hoverEnd={hoverEnd}
          weekStartsOn={weekStartsOn}
          onDayClick={handleDayClick}
          onDayHover={setHoverEnd}
        />
      </CalendarPopover>
    </div>
  )
}
