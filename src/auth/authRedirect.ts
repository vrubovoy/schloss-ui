// An app with no login form of its own sends an unauthenticated visitor to
// schlussel's hosted login page via a full browser navigation (not a
// client-side route change, since it's leaving the app entirely). This
// builds that URL: schlussel redirects back to return_to with a one-time
// authorization code (PKCE) once the user has signed in, and the app's own
// /auth/callback route exchanges it for the real token, so the token itself
// never travels through a URL.
import { generateCodeVerifier, generateCodeChallenge } from './pkce.js'

export const CODE_VERIFIER_STORAGE_KEY = 'pkce_code_verifier'

export interface AuthRedirectConfig {
  schluesselUrl: string
}

export async function buildLoginUrl(
  config: AuthRedirectConfig,
  currentPath: string,
  origin: string = window.location.origin,
): Promise<string> {
  const returnTo = `${origin}/auth/callback?next=${encodeURIComponent(currentPath)}`

  const verifier = generateCodeVerifier()
  sessionStorage.setItem(CODE_VERIFIER_STORAGE_KEY, verifier)
  const challenge = await generateCodeChallenge(verifier)

  const params = new URLSearchParams({
    return_to: returnTo,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  return `${config.schluesselUrl}/login?${params.toString()}`
}

// The session cookie is host-only to schlussel's own origin (no Domain
// attribute, by design - it's never shared cross-subdomain), so a consuming
// app can never clear it itself via a fetch proxied through its own origin -
// that request is same-origin from the browser's point of view (the app's,
// not schlussel's), and the cookie simply never gets sent. Instead this
// sends the browser to a real page hosted by schlussel (same-origin with
// the cookie there), which does the actual logout and bounces back to
// returnTo - the caller's own router guard then naturally redirects to
// login again, since there's no valid session left.
export function buildLogoutUrl(
  config: AuthRedirectConfig,
  returnTo: string = `${window.location.origin}/`,
): string {
  return `${config.schluesselUrl}/logout?return_to=${encodeURIComponent(returnTo)}`
}

// Account settings (password, delete account, ...) are unified across the
// whole platform, not a per-service concept - most apps have no account
// page of their own, same reasoning as having no login page of their own.
// No PKCE needed here (unlike login) - this is a plain link, not a redirect
// that has to hand a token back across the origin boundary.
export function buildAccountUrl(
  config: AuthRedirectConfig,
  currentPath: string,
  origin: string = window.location.origin,
): string {
  const returnTo = `${origin}${currentPath}`
  return `${config.schluesselUrl}/account?return_to=${encodeURIComponent(returnTo)}`
}
