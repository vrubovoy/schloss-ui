// Internal - not exported from the package. Calendar/CalendarPopover/
// DateField/DateRangeField all speak plain ISO (yyyy-mm-dd) strings at
// their public boundary; everything Date-object-shaped stays in here.

import type { DateFormat } from './dateFormat'

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

const WEEKDAY_LABELS_SUNDAY_FIRST = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] as const

export type WeekStartsOn = 0 | 1

export function getWeekdayLabels(weekStartsOn: WeekStartsOn = 1): readonly string[] {
  return weekStartsOn === 0
    ? WEEKDAY_LABELS_SUNDAY_FIRST
    : [...WEEKDAY_LABELS_SUNDAY_FIRST.slice(1), WEEKDAY_LABELS_SUNDAY_FIRST[0]]
}

export const WEEKDAY_LABELS = getWeekdayLabels()

export function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const [, y, mo, d] = m as unknown as [string, string, string, string]
  return new Date(Number(y), Number(mo) - 1, Number(d))
}

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDisplayDate(iso: string, dateFormat: DateFormat | null = 'dmy'): string {
  const date = parseISODate(iso)
  if (!date) return ''
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  if (dateFormat === 'mdy') return `${m}/${d}/${date.getFullYear()}`
  if (dateFormat === 'ymd') return `${date.getFullYear()}-${m}-${d}`
  return `${d}.${m}.${date.getFullYear()}`
}

export function monthLabel(month: Date): string {
  return `${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}`
}

export function addMonths(month: Date, delta: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + delta, 1)
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export interface MonthCell {
  iso: string
  day: number
  inMonth: boolean
  isToday: boolean
}

/** Always 42 cells (6 full weeks). Out-of-month cells carry no usable date
 * info for callers - Calendar renders them blank. */
export function getMonthGrid(month: Date, weekStartsOn: WeekStartsOn = 1): MonthCell[] {
  const first = startOfMonth(month)
  const leadingDays = (first.getDay() - weekStartsOn + 7) % 7
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - leadingDays)
  const todayIso = toISODate(new Date())

  const cells: MonthCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    const iso = toISODate(d)
    cells.push({
      iso,
      day: d.getDate(),
      inMonth: d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear(),
      isToday: iso === todayIso,
    })
  }
  return cells
}
