export type DateFormat = 'dmy' | 'mdy' | 'ymd'

export interface DatePrefs {
  dateFormat: DateFormat | null
  timezone: string | null
}

export function formatDate(iso: string, prefs?: DatePrefs | null): string {
  const date = new Date(iso)
  const timeZone = prefs?.timezone ?? undefined

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
