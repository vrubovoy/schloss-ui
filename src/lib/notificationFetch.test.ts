import { describe, expect, it } from 'vitest'
import { resolveActionUrl } from './notificationFetch'

describe('resolveActionUrl', () => {
  it('falls back when actionUrl is null', () => {
    expect(resolveActionUrl(null, 'https://glocke.localhost', 'https://glocke.localhost/notifications'))
      .toBe('https://glocke.localhost/notifications')
  })

  it('resolves a relative actionUrl (e.g. schlussel.security.password_changed.v1) against Glocke\'s origin, not the current page\'s', () => {
    expect(resolveActionUrl('/settings', 'https://glocke.localhost', 'https://glocke.localhost/notifications'))
      .toBe('https://glocke.localhost/settings')
  })

  it('uses an already-absolute actionUrl (e.g. Kuvert/Tafel\'s own domain events) as-is, not rebased onto Glocke', () => {
    expect(resolveActionUrl('https://kuvert.localhost/goals', 'https://glocke.localhost', 'https://glocke.localhost/notifications'))
      .toBe('https://kuvert.localhost/goals')
  })

  it('falls back on a malformed actionUrl instead of throwing', () => {
    expect(resolveActionUrl('not a url at all \\ x', 'not-a-valid-origin', 'https://glocke.localhost/notifications'))
      .toBe('https://glocke.localhost/notifications')
  })
})
