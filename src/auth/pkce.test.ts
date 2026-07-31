import { describe, expect, it } from 'vitest'
import { generateCodeChallenge, generateCodeVerifier } from './pkce'

describe('generateCodeVerifier', () => {
  it('returns a base64url string (only [A-Za-z0-9-_], no padding)', () => {
    const verifier = generateCodeVerifier()
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/)
    expect(verifier).not.toContain('=')
  })

  it('is well over 32 characters (derived from 32 random bytes)', () => {
    const verifier = generateCodeVerifier()
    expect(verifier.length).toBeGreaterThan(32)
  })

  it('is different on every call', () => {
    const a = generateCodeVerifier()
    const b = generateCodeVerifier()
    expect(a).not.toBe(b)
  })
})

describe('generateCodeChallenge', () => {
  it('resolves to a base64url string (only [A-Za-z0-9-_], no padding)', async () => {
    const challenge = await generateCodeChallenge('some-verifier-value')
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/)
    expect(challenge).not.toContain('=')
  })

  it('is deterministic for the same verifier', async () => {
    const verifier = generateCodeVerifier()
    const a = await generateCodeChallenge(verifier)
    const b = await generateCodeChallenge(verifier)
    expect(a).toBe(b)
  })

  it('differs for different verifiers', async () => {
    const a = await generateCodeChallenge('verifier-one')
    const b = await generateCodeChallenge('verifier-two')
    expect(a).not.toBe(b)
  })

  it('matches an independently computed SHA-256 base64url digest', async () => {
    const verifier = 'independent-verification-verifier'
    const expected = await independentChallenge(verifier)
    const actual = await generateCodeChallenge(verifier)
    expect(actual).toBe(expected)
  })
})

// Computes the expected PKCE code challenge independently of the module
// under test, using the Web Crypto API directly (RFC 7636 S256 method).
async function independentChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  let binary = ''
  for (const byte of new Uint8Array(digest)) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
