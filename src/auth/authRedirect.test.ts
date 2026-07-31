import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildAccountUrl,
  buildLoginUrl,
  buildLogoutUrl,
  CODE_VERIFIER_STORAGE_KEY,
} from './authRedirect'
import { generateCodeChallenge } from './pkce'
import type { AuthRedirectConfig } from './authRedirect'

const config: AuthRedirectConfig = { schluesselUrl: 'https://auth.example.test' }

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  sessionStorage.clear()
})

describe('CODE_VERIFIER_STORAGE_KEY', () => {
  it('is "pkce_code_verifier"', () => {
    expect(CODE_VERIFIER_STORAGE_KEY).toBe('pkce_code_verifier')
  })
})

describe('buildLoginUrl', () => {
  it('starts with `${schluesselUrl}/login?`', async () => {
    const url = await buildLoginUrl(config, '/dashboard')
    expect(url.startsWith('https://auth.example.test/login?')).toBe(true)
  })

  it('stores a non-empty verifier in sessionStorage under CODE_VERIFIER_STORAGE_KEY', async () => {
    expect(sessionStorage.getItem(CODE_VERIFIER_STORAGE_KEY)).toBeNull()
    await buildLoginUrl(config, '/dashboard')
    const stored = sessionStorage.getItem(CODE_VERIFIER_STORAGE_KEY)
    expect(stored).toEqual(expect.any(String))
    expect(stored?.length).toBeGreaterThan(0)
  })

  it('includes return_to = `${origin}/auth/callback?next=${encodeURIComponent(currentPath)}`', async () => {
    const url = await buildLoginUrl(config, '/some/path?x=1', 'https://app.example.test')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('return_to')).toBe(
      'https://app.example.test/auth/callback?next=' + encodeURIComponent('/some/path?x=1'),
    )
  })

  it('includes code_challenge_method=S256', async () => {
    const url = await buildLoginUrl(config, '/dashboard')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256')
  })

  it('includes a code_challenge that matches the base64url SHA-256 of the stored verifier', async () => {
    const url = await buildLoginUrl(config, '/dashboard')
    const parsed = new URL(url)
    const codeChallenge = parsed.searchParams.get('code_challenge')
    expect(codeChallenge).toEqual(expect.any(String))
    expect(codeChallenge?.length).toBeGreaterThan(0)

    const storedVerifier = sessionStorage.getItem(CODE_VERIFIER_STORAGE_KEY)
    expect(storedVerifier).not.toBeNull()
    const expectedChallenge = await generateCodeChallenge(storedVerifier as string)
    expect(codeChallenge).toBe(expectedChallenge)
  })

  it('defaults origin to window.location.origin when omitted', async () => {
    const url = await buildLoginUrl(config, '/dashboard')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('return_to')).toBe(
      `${window.location.origin}/auth/callback?next=${encodeURIComponent('/dashboard')}`,
    )
  })
})

describe('buildLogoutUrl', () => {
  it('defaults returnTo to `${window.location.origin}/`', () => {
    const url = buildLogoutUrl(config)
    expect(url).toBe(
      `https://auth.example.test/logout?return_to=${encodeURIComponent(`${window.location.origin}/`)}`,
    )
  })

  it('uses an explicit returnTo when provided', () => {
    const url = buildLogoutUrl(config, 'https://app.example.test/goodbye')
    expect(url).toBe(
      'https://auth.example.test/logout?return_to=' +
        encodeURIComponent('https://app.example.test/goodbye'),
    )
  })
})

describe('buildAccountUrl', () => {
  it('returns `${schluesselUrl}/account?return_to=${encodeURIComponent(origin + currentPath)}`', () => {
    const url = buildAccountUrl(config, '/settings', 'https://app.example.test')
    expect(url).toBe(
      'https://auth.example.test/account?return_to=' +
        encodeURIComponent('https://app.example.test/settings'),
    )
  })

  it('defaults origin to window.location.origin when omitted', () => {
    const url = buildAccountUrl(config, '/settings')
    expect(url).toBe(
      'https://auth.example.test/account?return_to=' +
        encodeURIComponent(`${window.location.origin}/settings`),
    )
  })

  it('does not touch sessionStorage (no PKCE involved)', () => {
    sessionStorage.clear()
    buildAccountUrl(config, '/settings')
    expect(sessionStorage.getItem(CODE_VERIFIER_STORAGE_KEY)).toBeNull()
  })
})
