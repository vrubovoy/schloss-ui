# schloss-ui

[![Test](https://github.com/zudaR107/schloss-ui/actions/workflows/test.yml/badge.svg)](https://github.com/zudaR107/schloss-ui/actions/workflows/test.yml)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

Part of the [Hof platform](https://github.com/zudaR107/Hof) — a suite of
self-hosted personal services:

- [`schloss`](https://github.com/zudaR107/schloss) — home page / launcher
- [`schlussel`](https://github.com/zudaR107/schlussel) — auth: accounts, login, tokens
- [`kuvert`](https://github.com/zudaR107/kuvert) — envelope budgeting
- [`tafel`](https://github.com/zudaR107/tafel) — task/project tracking
- [`zettel`](https://github.com/zudaR107/zettel) — markdown note-taking
- [`glocke`](https://github.com/zudaR107/glocke) — in-app notification center and delivery foundation
- [`tor`](https://github.com/zudaR107/tor) — reverse-proxy gateway
- **`schloss-ui`** (this repo) — shared frontend components
- [`schloss-server-kit`](https://github.com/zudaR107/schloss-server-kit) — shared backend auth/CORS kit

Shared design tokens and layout components consumed by
[`schloss`](https://github.com/zudaR107/schloss),
[`schlussel`](https://github.com/zudaR107/schlussel)'s frontend app,
[`kuvert`](https://github.com/zudaR107/kuvert)'s frontend app,
[`tafel`](https://github.com/zudaR107/tafel)'s frontend app, and
[`zettel`](https://github.com/zudaR107/zettel)'s frontend app.

## What this is (and isn't)

Every Schloss service already shares the same underlying design tokens
(spacing, radius, shadow, typography, neutral and semantic colors) — they
were just hand-copied into each repo independently, drifting slightly
with every edit. This package makes that sharing real: one source of
truth, versioned and installed like any other dependency, instead of
three copies to keep in sync by hand.

What it deliberately does **not** do: force every service to look
identical. Each service keeps its own brand mark (its own hand-drawn
logo/icon) and its own accent color, layered on top of the shared core —
same family, distinct identity. See "Design tokens" below for the exact
pattern.

## Status

Tokens and all components are done and adopted by every consumer (schloss,
schlussel, kuvert, tafel, zettel) — see the
[issue tracker](https://github.com/zudaR107/schloss-ui/issues) for
ongoing/proposed work.

## Components

`Header`, `Footer`, `EmptyState`, `DirectExportAction`, `Button`, `Badge`,
`SegmentedControl`, `Field`, `NumberField`, `AmountField`, `DateField`,
`DateRangeField`, `Modal`, `StatTile`, `Amount`, `Sparkline`, `Toast`, `ThemeToggle` — all
exported from the package root (`import { Button } from
'@zudar107/schloss-ui'`), styled entirely from the shared tokens plus
each consumer's own `--accent`.

`Header`'s avatar doubles as the account-settings entry point: when both
`user` and `onSettings` are given it renders as a real button (there is
no separate settings icon) — see the "unified account settings" contract
documented in schlussel's own README for how `onSettings` is meant to be
wired. Its optional controlled `notifications={{ href, state }}` contract adds
a notification-center link only when `user` is present. `state` is the
discriminated `HeaderNotificationState` (`loading`, `ready` with an exact
`unreadCount`, or `error` with an optional retained count); the compact bell
uses exact count-aware accessible labels and caps only its visual badge at
`99+`. Controls remain ordered `rightSlot`, bell, logout, avatar.

`useUnreadNotifications({ glockeOrigin, userId, apiClient })` supplies that
controlled state from Glocke's `/backend/notifications/unread-count` endpoint.
The configured value must be an origin-only HTTPS URL (HTTP is accepted only
for localhost development). The hook sends the in-memory bearer token with
credentials omitted, polls while visible and online with jitter, refreshes on
focus/visibility/page-show/online recovery, retains the last valid count on
nonfatal failures, and silently refreshes and retries once on a 401. Every
request and retry reads the live token from `apiClient.getAccessToken()`; a
cleared or replaced token is never recovered from hook-local state. Pair its
result with the Header without coupling the shared component to routing. Older
structural `ApiClient` implementations without `refreshAccessToken` remain
supported; their unread 401 is reported as a nonfatal error without a retry:

```tsx
const notificationState = useUnreadNotifications({ glockeOrigin, userId: user?.id ?? null, apiClient })

<Header
  logo={<Logo />}
  homeHref="/"
  user={user}
  notifications={{ href: `${glockeOrigin}/notifications`, state: notificationState }}
/>
```

After a successful notification mutation, call
`invalidateNotificationUnreadCount()`. Mounted unread hooks in the current
window refresh immediately (without waiting for the focus-recovery throttle),
and same-origin tabs are notified through `BroadcastChannel`. Invalidations that
arrive during an in-flight unread request coalesce into exactly one mandatory
follow-up fetch, so its pre-mutation result cannot remain current. Unsupported
browsers retain same-window behavior, and the cross-tab message contains only
an invalidation type plus an opaque sender ID, never a token, count, or
notification content.

`ThemeToggle` is a dropdown for picking one of the platform's four themes
(`light`/`dark`/`oled`/`sepia`, see the `Theme`/`THEMES`/`getStoredTheme`/
`applyTheme` exports it's built on). Its default look is a ghost icon
button meant for a header's `rightSlot`; pass a `trigger` render prop
(`({ theme, icon, onClick }) => ReactNode`) to fit it into a different
context instead (e.g. a sidebar row) — see kuvert's `Layout.tsx` for an
example — plus `align="left"|"right"` for which side the dropdown panel
anchors to. It also follows `THEME_CHANGE_EVENT`, so a choice adopted by
`ThemeSync` immediately updates every mounted toggle. `ThemeSync` reconciles
both GET and PUT responses by timestamp; a server-winning PUT is adopted only
while it is newer than the latest local choice.

`NumberField`/`AmountField` display thousand-space-grouped numbers while
keeping the caller's state as a plain unformatted string, and select an
existing `"0"` on focus so the first keystroke replaces it instead of
prepending. `AmountField` is `NumberField` with a currency-symbol prefix
derived from an ISO 4217 `currencyCode` prop (defaults to `'RUB'`).
`DateField`/`DateRangeField` are a custom Avito-style calendar (own
popover, no native `<input type="date">`) speaking plain ISO
`yyyy-mm-dd` strings — `DateRangeField` is a two-click range picker
(first click = start, second = end, third restarts; a colored bar spans
the selected range). Both accept optional profile-facing `dateFormat`
(`dmy`/`mdy`/`ymd`, default `dmy`) and `weekStartsOn` (`0` for Sunday or `1`
for Monday, the default); the weekday headers and six-week day grid use the
same week start. Also exported: `handleArrowFieldNavigation` (attach
to a `<form>`'s `onKeyDown` — ArrowUp/ArrowDown move focus between
fields instead of the browser's native per-element behavior) and the low-
level `formatGroupedNumber`/`parseGroupedNumber`/`currencySymbol`
helpers `NumberField`/`AmountField` are built on, for bespoke inputs that
need the same formatting without the full `Field` label/box chrome.
`formatDate(iso, prefs)` and its `DateFormat`/`DatePrefs` types apply a
profile's `dmy`/`mdy`/`ymd` and IANA-timezone preferences; null preferences
retain the existing browser-local `ru-RU` date format. Exact `YYYY-MM-DD`
values remain the same calendar date in every timezone, while a malformed
profile timezone gracefully falls back to browser-local formatting.

`Modal` moves focus inside when opened, keeps Tab navigation within the
dialog, and restores focus when closed, while retaining its Escape-to-close
and Enter-to-primary-action behavior. Its focus trap ignores hidden and
disabled controls, including controls disabled by an ancestor `fieldset`, and
includes native tabbable `summary` and contenteditable elements.

`Field` links inline error text to its input or select with
`aria-describedby`; when callers supply their own descriptor IDs, the error ID
is appended rather than replacing them.

`DirectExportAction` is the shared settings-page presentation for downloading
one service's authenticated JSON snapshot. Callers provide its labels,
controlled `loading`/`error` state, and `onExport`; while loading, the native
button is disabled and repeated activation is ignored, and errors are announced
assertively. `downloadJson(data, filename)` serializes readable UTF-8 JSON into
an `application/json` Blob, downloads it under the exact safe, deterministic
filename supplied by the caller, and always revokes its object URL. Endpoint
selection, authorization, fetching, and filename construction remain the
calling service's responsibility.

## Auth & sidebar helpers

Every frontend app on the platform authenticates against schlussel the
same way (PKCE login redirect, in-memory access token, silent refresh on
mount), so that logic lives here as config-driven exports rather than
being copy-pasted per app:

- `generateCodeVerifier`/`generateCodeChallenge` — PKCE (RFC 7636).
- `buildLoginUrl(config, currentPath)`/`buildLogoutUrl(config, returnTo?)`/
  `buildAccountUrl(config, currentPath)` — build full-page-navigation URLs
  to schlussel's hosted login/logout/account pages, given
  `config: { schluesselUrl }`. `buildLoginUrl` also stashes a fresh PKCE
  verifier in `sessionStorage` under `CODE_VERIFIER_STORAGE_KEY`.
- `createApiClient({ base, authBase?, onUnauthorized })` — an in-memory-
  token `fetch` wrapper (`get`/`post`/`put`/`delete`) for the app's own
  `base` API prefix, auto-retrying once on a 401 via `${authBase}/refresh`
  (default `authBase` is `'/auth'`) before giving up and calling
  `onUnauthorized()`; a retry that also returns 401 clears the refreshed
  in-memory token before invoking the callback. Its public
  `refreshAccessToken()` performs the same refresh as a silent single-flight
  operation, returning the token or `null` without invoking `onUnauthorized`.
  Refresh results are generation-fenced, so a late response cannot restore a
  logged-out token or replace a newer token. Flights are shared only within the
  same external session generation. Internal refresh rotates the access token
  without changing that generation, so concurrent old-token 401 responses retry
  once with the already-refreshed current token instead of failing or refreshing
  again. Logout/new-login through `setAccessToken` advances the session generation,
  fencing stale requests and refreshes without clearing or calling `onUnauthorized`
  for the newer session. The method is optional on the base `ApiClient` interface
  for source compatibility with existing structural clients; `createApiClient`
  returns `CreatedApiClient` and always provides it.
- `AuthContext`/`useAuth()`/`useAuthProvider({ apiClient, authBase? })` —
  React auth state: bootstraps via a silent `${authBase}/refresh` +
  `${authBase}/me` on mount, exposes `{ user, loading, logout, setUser }`.
- `useSidebarWidth({ storageKey, ... })` — the resize-drag/collapse-
  threshold/localStorage-persistence state machine behind a resizable app
  sidebar, returning `{ width, collapsed, dragging, toggleCollapsed,
  startDrag }`. Deliberately *not* a full `<Sidebar>` component — the
  surrounding markup (logo, nav items, user block, theme toggle, logout
  button) differs enough per app that only the state machine, not the
  JSX, is shared. See kuvert's `Layout.tsx` for the reference wiring.

## Localization (i18n)

Every frontend app will eventually need to show its UI in more than one
language, so the language-detection/persistence wiring lives here as one
shared factory rather than each app hand-rolling its own i18next setup —
mirrors how `theme.ts` centralizes theme persistence (see "Design
tokens" above) instead of leaving that to every consumer.

**This is infrastructure only.** No actual translated strings exist
anywhere on the platform yet — every app is still Russian-only,
hardcoded exactly as before. This module doesn't localize anything by
itself; it just gives every app the same plumbing to hang real
translations on whenever that work happens, app by app.

- `Language`/`LANGUAGES` — the type (`'ru' | 'en'`) and array of every
  language the platform will eventually support. English is on the
  roadmap but not written yet; the type/constant exist now so consumers
  build against the real eventual set instead of a stringly-typed `'ru'`.
- `getStoredLanguage()`/`setStoredLanguage(language)` — read/write the
  chosen language under a `schloss-language` localStorage key, the same
  pattern as `theme.ts`'s `schloss-theme` key. `getStoredLanguage`
  defaults to `'ru'` when nothing (or something invalid) is stored.
- `createI18n({ resources })` — builds one i18next + react-i18next
  instance for the calling app, initialized to `getStoredLanguage()`
  with `fallbackLng: 'ru'`. Not a shared singleton: each app owns its
  own translation resources, so each app calls this once and gets back
  its own instance.
- `setLanguage(instance, language)` — the one function that actually
  changes the active language: updates the running instance and
  persists the choice via `setStoredLanguage`, so a later reload picks
  it back up.

A consumer wires it up by passing its own flat key → string dict per
language:

```ts
import { createI18n } from '@zudar107/schloss-ui'

const i18n = createI18n({
  resources: {
    ru: { greeting: 'Привет' },
    en: {},
  },
})
```

`en: {}` (or omitting `en` entirely) is the expected normal state
today — every app's real strings live under `ru` only. That's not a
bug to work around: i18next's own fallback (covered by this module's
tests) means a missing English string silently renders the Russian
text instead of breaking anything, so `en` can be filled in key by key,
later, without any of this factory changing.

## Installing

Not published to any registry — this is an internal package, consumed by
each service as a git submodule linked through pnpm's `workspace:*`
protocol. To add it to a new service:

```
git submodule add https://github.com/zudaR107/schloss-ui.git schloss-ui
```

Add `"schloss-ui"` to that repo's `pnpm-workspace.yaml` `packages:` list,
add `"@zudar107/schloss-ui": "workspace:*"` to whichever `package.json`
needs it, then `pnpm install`. schloss-ui is still consumed as its built
`dist/` output (same `main`/`module`/`types`/`exports` as always), so run
`pnpm --filter @zudar107/schloss-ui build` once before that service's own
`dev`/`build`/`test` — the same step Dockerfiles and CI run before
building/testing the consuming app.

## Design tokens

`import '@zudar107/schloss-ui/tokens.css'` (once, in each app's entry
point, before any of its own CSS) brings in every core token as a CSS
custom property: radius (`--radius-sm/md/lg/xl`), shadow
(`--shadow-sm/md/lg`), font (`--font-sans`), and the full neutral/text/
semantic (`--success/warning/danger/info`) palette for four themes,
switched via `data-theme="light|dark|oled|sepia"` on `<html>` (defaults
to light).

**Not** included, by design — each consumer defines these itself, on top
of the shared tokens, as its own brand identity:

| Token | schloss | schlussel | kuvert |
|---|---|---|---|
| `--accent` | `#863bff` | `#3b82f6` | `#0d9488` |
| `--accent-hover` | `#7228e0` | `#2563eb` | `#0b7d73` |
| `--accent-muted` | `#f3ebff` | `#eff6ff` | `#ccfbf1` |
| `--accent-text` | pick a legible text-on-muted shade near your accent | `#1d4ed8` | pick similarly |
| `--sidebar-accent` | same as `--accent` | same as `--accent` | same as `--accent` |

Two colors were chosen deliberately, not just picked-to-differ:
schloss's accent now matches its own logo (previously mismatched — blue
UI, purple logo); kuvert's teal is intentionally distinct from the
shared `--success` green so "brand accent" and "positive/success" don't
read as the same signal. schlussel keeps the platform's original blue as
its own signature.

`--sidebar-accent` is listed here (not left to inherit a hardcoded
value) because it's accent-derived, not neutral — leaving it in the
shared file would silently keep every service's sidebar highlight blue
regardless of its own `--accent`, the exact kind of accidental-default
bleed this package exists to prevent.

## Icons

[lucide-react](https://lucide.dev) is the canonical icon set across the
platform (already used everywhere) — this isn't a component, just a
contract so icon usage stops being re-derived ad hoc. Today's sizes
(15/18/20/24px) and strokeWidth (2/2.2 mixed) are inconsistent across
the three services; this is the fix.

**Size** — reference `ICON_SIZE` (exported from the package) instead of
a magic number:

```ts
import { ICON_SIZE } from '@zudar107/schloss-ui'

<Settings size={ICON_SIZE.default} strokeWidth={2} />
```

| Name | Value | Use |
|---|---|---|
| `ICON_SIZE.dense` | 14px | Dense lists, inline with small text |
| `ICON_SIZE.default` | 16px | Nav items, buttons, form fields |
| `ICON_SIZE.emphasis` | 20px | Page headers, the shared `Header` component |
| `ICON_SIZE.illustrative` | 28px | Empty states, illustrative badges |

**strokeWidth: 2, always** — matches lucide-react's own default. A few
brand-mark badges use 2.2 today; standardize down to 2 everywhere,
including those.

**Color** — four states, no in-between "eyeballed" grays:

| State | Token | When |
|---|---|---|
| Muted | `--text-secondary` | Default, secondary action |
| Primary | `--text-primary` | Structural, part of content rather than an action |
| Accent | `--accent` | Active/selected, e.g. the current nav item |
| White | `#ffffff` / `--text-inverted` | Inside a filled `--accent` surface (a badge, a primary button) |

## Developing

```sh
pnpm install
pnpm lint       # oxlint
pnpm typecheck  # tsc --noEmit
pnpm test       # vitest
pnpm build      # tsup -> dist/ (ESM + .d.ts)
```

No release/publish step - each consumer picks up changes by bumping its
own `schloss-ui` submodule pointer to whatever commit on `main` it wants
(`cd schloss-ui && git pull && cd .. && git add schloss-ui`), same as any
other cross-repo bump on this platform. `version` in `package.json` is
kept purely as a human-readable changelog marker, not tied to any tag or
publish step.

## License

AGPL-3.0 — see [LICENSE](LICENSE).
