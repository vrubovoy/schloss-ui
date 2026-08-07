import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useHover } from '../hooks/useHover'
import {
  addMonths, getMonthGrid, getWeekdayLabels, monthLabel, type WeekStartsOn,
} from '../lib/dateUtils'

// Internal - not exported from the package. Shared month-grid primitive
// used by both DateField (single-select) and DateRangeField (two-click
// range-select, `end` always '' in single mode).
export interface CalendarProps {
  initialMonth: Date
  start: string
  end: string
  /** Live preview of the second endpoint while hovering, before it's
   * clicked. Ignored once `end` is actually set. */
  hoverEnd: string | null
  weekStartsOn?: WeekStartsOn | null
  onDayClick: (iso: string) => void
  onDayHover: (iso: string | null) => void
}

const navButtonBaseStyle = {
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 4,
  borderRadius: 6,
} as const

function DayCell({
  iso, day, isToday, isStart, isEnd, between, onClick, onHover,
}: {
  iso: string
  day: number
  isToday: boolean
  isStart: boolean
  isEnd: boolean
  between: boolean
  onClick: () => void
  onHover: () => void
}) {
  const hover = useHover()
  const selected = isStart || isEnd
  const radius =
    isStart && isEnd ? 6 :
    isStart ? '6px 0 0 6px' :
    isEnd ? '0 6px 6px 0' :
    between ? 0 : 6

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={(e) => { hover.onMouseEnter(e); onHover() }}
      onMouseLeave={hover.onMouseLeave}
      aria-label={iso}
      aria-pressed={selected}
      style={{
        border: isToday && !selected ? '1px solid var(--border-strong)' : 'none',
        background: selected ? 'var(--accent)' : between ? 'var(--accent-muted)' : hover.hovered ? 'var(--bg-base)' : 'transparent',
        color: selected ? 'var(--text-inverted)' : 'var(--text-primary)',
        borderRadius: radius,
        cursor: 'pointer',
        fontSize: '0.8125rem',
        padding: '0.4rem 0',
        fontFamily: 'inherit',
        transition: 'background 100ms',
      }}
    >
      {day}
    </button>
  )
}

export function Calendar({
  initialMonth, start, end, hoverEnd, weekStartsOn, onDayClick, onDayHover,
}: CalendarProps) {
  const [month, setMonth] = useState(initialMonth)
  const normalizedWeekStartsOn = weekStartsOn ?? 1
  const cells = getMonthGrid(month, normalizedWeekStartsOn)
  const weekdayLabels = getWeekdayLabels(normalizedWeekStartsOn)

  // The hovered candidate renders exactly like a committed `end` (full
  // accent fill, not just the muted between-color) - that's what makes it
  // read as a live preview instead of a mere highlight.
  const effectiveEnd = end || (start && hoverEnd ? hoverEnd : '')

  function isBetween(iso: string): boolean {
    if (!start || !effectiveEnd || start === effectiveEnd) return false
    const lo = start < effectiveEnd ? start : effectiveEnd
    const hi = start < effectiveEnd ? effectiveEnd : start
    return iso > lo && iso < hi
  }

  return (
    <div style={{ width: 280, padding: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <button type="button" onClick={() => setMonth((m) => addMonths(m, -1))} style={navButtonBaseStyle} aria-label="Предыдущий месяц">
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {monthLabel(month)}
        </span>
        <button type="button" onClick={() => setMonth((m) => addMonths(m, 1))} style={navButtonBaseStyle} aria-label="Следующий месяц">
          <ChevronRight size={16} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
        {weekdayLabels.map((w) => (
          <div key={w} style={{ textAlign: 'center', fontSize: '0.6875rem', color: 'var(--text-muted)', padding: '0.25rem 0' }}>
            {w}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((cell) =>
          cell.inMonth ? (
            <DayCell
              key={cell.iso}
              iso={cell.iso}
              day={cell.day}
              isToday={cell.isToday}
              isStart={cell.iso === start}
              isEnd={cell.iso === effectiveEnd}
              between={isBetween(cell.iso)}
              onClick={() => onDayClick(cell.iso)}
              onHover={() => onDayHover(cell.iso)}
            />
          ) : (
            <div key={cell.iso} />
          ),
        )}
      </div>
    </div>
  )
}
