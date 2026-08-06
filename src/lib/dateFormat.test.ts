import { describe, expect, it } from 'vitest'
import { formatDate } from '../index'

describe('formatDate', () => {
  it.each([
    ['dmy', '05.08.2026'],
    ['mdy', '08/05/2026'],
    ['ymd', '2026-08-05'],
  ] as const)('formats a profile date using the %s preference', (dateFormat, expected) => {
    expect(
      formatDate('2026-08-05T12:00:00.000Z', {
        dateFormat,
        timezone: 'UTC',
      }),
    ).toBe(expected)
  })

  it('uses the profile timezone when a timestamp crosses a calendar-day boundary', () => {
    const timestamp = '2026-08-05T23:30:00.000Z'

    expect(formatDate(timestamp, { dateFormat: 'ymd', timezone: 'UTC' })).toBe('2026-08-05')
    expect(formatDate(timestamp, { dateFormat: 'ymd', timezone: 'Europe/Moscow' })).toBe('2026-08-06')
  })

  it('keeps the ru-RU default when profile preferences are null', () => {
    const timestamp = '2026-08-05T12:00:00.000Z'

    expect(formatDate(timestamp, { dateFormat: null, timezone: null })).toBe(
      new Date(timestamp).toLocaleDateString('ru-RU'),
    )
    expect(formatDate(timestamp, null)).toBe(new Date(timestamp).toLocaleDateString('ru-RU'))
    expect(formatDate(timestamp)).toBe(new Date(timestamp).toLocaleDateString('ru-RU'))
  })
})
