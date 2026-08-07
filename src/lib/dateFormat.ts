export type DateFormat = 'dmy' | 'mdy' | 'ymd'

export interface DatePrefs {
  dateFormat: DateFormat | null
  timezone: string | null
}

export function formatDate(iso: string, prefs?: DatePrefs | null): string {
  const date = new Date(iso)
  let timeZone = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? 'UTC' : prefs?.timezone ?? undefined

  if (timeZone) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone })
    } catch {
      timeZone = undefined
    }
  }

  if (!prefs?.dateFormat) {
    return date.toLocaleDateString('ru-RU', timeZone ? { timeZone } : undefined)
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  const day = get('day')
  const month = get('month')
  const year = get('year')

  if (prefs.dateFormat === 'mdy') return `${month}/${day}/${year}`
  if (prefs.dateFormat === 'ymd') return `${year}-${month}-${day}`
  return `${day}.${month}.${year}`
}
