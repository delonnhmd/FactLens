# FactFight migration Step 3 report

Date: 2026-07-15

Status: complete

Scope: Supabase SSR authentication foundation only. No real feed, claims, voting, evidence, search, leaderboard, moderation, image upload, production landing page, backend change, SQL, DNS, or deployment work was performed.

## Existing foundation found

Step 2 was already complete and valid. The isolated Next.js 16 App Router scaffold, TypeScript, Tailwind CSS, ESLint, design tokens, import alias, scripts, and requested dependencies were present. Step 3 extended that foundation without replacing the existing structure or changing package versions.

## Files created

- `.env.example`
- `.env.local` (local-only and ignored by Git)
- `src/proxy.ts`
- `src/lib/validation/env.ts`
- `src/lib/validation/auth.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/proxy.ts`
- `src/lib/api/auth.ts`
- `src/app/(auth)/actions.ts`
- `src/app/(auth)/layout.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/signup/page.tsx`
- `src/app/(auth)/confirmed/page.tsx`
- `src/app/auth/callback/route.ts`
- `src/app/(main)/layout.tsx`
- `src/app/(main)/feed/page.tsx`
- `src/components/auth/login-form.tsx`
- `src/components/auth/signup-form.tsx`
- `STEP_3_REPORT.md`

## Files changed

- `src/app/page.tsx`: added `Log in` and `Create account` links while retaining the temporary development-preview page and disabled `Open FactFight` button.

No package version or script change was required. `.gitignore` already ignored `.env*` while allowing `.env.example`, so it was verified rather than modified.

## Environment configuration

Environment variable names used:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_RENDER_BACKEND_URL`
- `NEXT_PUBLIC_SITE_URL`

Only the two approved public Expo values were read from the root `.env` and mapped to their FactFight names in `.env.local`. The Render URL and localhost site URL were also set as requested. No other root environment variable was read or copied.

Actual Supabase URL and anon-key values were never printed in terminal output, reports, source files, screenshots, or error messages. A content scan confirmed that neither raw public value was duplicated outside the ignored `.env.local` file.

`src/lib/validation/env.ts` validates the four named public variables with Zod and exports one immutable `publicEnvironment` object. Configuration errors list variable names only, never their values.

## Supabase client architecture

- Browser: `src/lib/supabase/client.ts` uses `createBrowserClient` from `@supabase/ssr`. It is marked for Client Components and contains no React Native storage or privileged key.
- Server: `src/lib/supabase/server.ts` uses `createServerClient`, the asynchronous Next.js 16 `cookies()` API, and `getAll`/`setAll`. It creates a new client for every call/request and safely tolerates the documented Server Component cookie-write limitation because the proxy handles refresh writes.
- Session refresh: `src/lib/supabase/proxy.ts` reads request cookies, writes refreshed cookies to the forwarded request and returned response, copies the required no-cache response headers, and calls `auth.getClaims()`.
- Authorization: neither the protected route nor proxy uses `getSession()` as an authorization decision.

The application uses `src/proxy.ts`, exporting the required async function named `proxy`. It excludes Next static/image routes, favicons, common image/font assets, source maps, robots, and sitemap paths. It has no Edge runtime declaration.

No `src/middleware.ts` or other `middleware.ts` file was created. Next.js labels the compiled proxy category as `Proxy (Middleware)` in build output; the actual application entrypoint is `src/proxy.ts`.

## Existing Render contracts confirmed

### Username availability

The mobile service and backend expose two related contracts:

- `POST /identity/check-username`
  - Body: `{ "username": string }`
  - Response fields: `available`, `reserved`, `message`, `normalized_key`, and optional `warning`
- `GET /auth/username-availability?username=<encoded username>`
  - Optional bearer identity is supported for excluding the current user.
  - Response fields: `ok`, `available`, `reserved`, `normalized_username`, and `message`

FactFight signup uses the second, public full-availability contract because it checks system/protected reservations, profile rows, and auth-user metadata for already-taken usernames. Requests have a 10-second timeout and normalized friendly failures.

Existing mobile username validation was preserved: the normalized username is 3–20 characters and may contain only lowercase letters, numbers, and underscores. Input may start with `@`; normalization strips that prefix and lowercases the result.

The current mobile signup does not expose a separate display-name field or independent display-name limit; it uses the username for `displayName`. FactFight adds the required field with a conservative 1–50 character rule while retaining the existing approved `displayName` metadata key.

### Profile ensure

- `POST /profile/ensure`
- Required header: `Authorization: Bearer <access token>`
- Body: `{ "username": string, "display_name": string }`
- Success response: `{ "ok": true, "profile": ... }`

The backend derives identity from the bearer token. It returns an existing safe profile when present or creates the missing profile after rechecking username availability. The web helper does not accept or send trust, reputation, score, verification, role, badge, or admin fields.

### Terms acceptance

- `POST /api/users/me/accept-terms`
- Required header: `Authorization: Bearer <access token>`
- Body: none
- Success response: `{ "ok": true }`

The endpoint records `terms_accepted_at` for the authenticated profile. It is called only after an authenticated profile is ensured. No token is logged.

## Validation and auth flows

Login validation requires a normalized valid email and a non-empty password.

Signup validation requires:

- A normalized 3–20 character username using letters, numbers, or underscores
- A 1–50 character display name
- A normalized valid email
- A password of at least 8 characters
- A matching confirmation password
- Explicit Terms of Use acceptance

The form contains only these user-authored fields. It cannot submit trusted scoring, reputation, verification, role, moderation, badge, AI, or admin fields.

### Login

1. The server action validates the form.
2. Supabase `signInWithPassword` authenticates the credentials.
3. `auth.getClaims()` validates the resulting server-side auth state.
4. Only the returned access token is forwarded to Render `/profile/ensure`.
5. Success redirects to `/feed`; failures return fixed, friendly messages without raw Supabase or Render errors.

### Signup

1. The server action validates every field.
2. Render checks full username availability.
3. Supabase `signUp` receives only the approved mobile metadata keys: `username` and `displayName`.
4. The email redirect is `${NEXT_PUBLIC_SITE_URL}/auth/callback`.
5. When Supabase immediately returns a session, `getClaims()` validates it, Render ensures the profile, Render records terms acceptance, and the action redirects to `/feed`.
6. When email confirmation is required, the action redirects to `/confirmed` without claiming that verification or profile initialization succeeded.

### Callback

`src/app/auth/callback/route.ts` reads the PKCE authorization code, calls `exchangeCodeForSession`, validates the resulting claims, ensures the profile with the returned access token, records the signup terms acceptance, and redirects to `/feed`.

Terms are recorded in this branch only after the one-time confirmation exchange and profile ensure. This is the branch where signup returned no access token, so acceptance could not have been recorded by the immediate-session flow. A failed callback signs out and redirects to `/login` with one of a fixed set of safe error codes.

Only a relative internal `next` value is accepted. Scheme-relative values and backslash-containing paths are rejected, so no provider-supplied or external redirect target is trusted.

### Logout

The server action calls Supabase `signOut` and redirects to `/login`.

## Protected route behavior

`/feed` is still an authentication placeholder and does not query claims or privileged profile fields. It creates the per-request server client, calls `auth.getClaims()`, and redirects unauthenticated users to `/login`. Authenticated users see:

- `Authenticated FactFight preview`
- A safe email or shortened subject identifier from verified claims
- A message that the community feed will be migrated next
- A server-action logout button

## Security checks

Pass:

- `.env.local` is ignored by Git.
- No `middleware.ts` exists.
- No `getSession()` authorization usage exists under `src/`.
- No React Native, Expo, or AsyncStorage code exists under `src/`.
- Runtime/config files contain no privileged secret variable reference, service-role client, internal safety secret reference, or hardcoded access/refresh token pattern.
- Only the public Supabase URL and public anon key are used to initialize browser-accessible Supabase code.
- Raw approved public values do not appear outside `.env.local`.
- Bearer tokens are constructed only inside the narrow server-side Render helpers and are never logged or returned to the browser.

The pre-existing migration audit contains prohibited secret names only as security-policy prose explaining that they must never be added. It contains no values or assignments and remained unchanged.

## Commands executed

Required commands:

```text
npm.cmd install
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

Additional validation included:

```text
npm.cmd audit --json
git check-ignore .env.local
git status --short
Targeted rg security and architecture scans
Next.js development-server HTTP route smoke tests on 127.0.0.1:3100
Headless Chrome render and console-error-signature checks for /login and /signup
```

The first production-build attempt identified a malformed local environment file structure and failed with variable names only. The file was corrected to four distinct non-empty lines without printing any value. The final lint, typecheck, and build runs all passed.

## Lint result

Pass.

```text
> eslint .
Exit code: 0
```

No lint warnings or errors remain.

## TypeScript result

Pass.

```text
> tsc --noEmit
Exit code: 0
```

## Production build result

Pass.

```text
> next build
Next.js 16.2.10 (Turbopack)
Compiled successfully
Static: /, /confirmed, /signup
Dynamic: /auth/callback, /feed, /login
Proxy entry compiled
Exit code: 0
```

## Route smoke-test results

Development-server HTTP checks:

- `/`: HTTP 200; FactFight preview content present
- `/login`: HTTP 200; login content present
- `/signup`: HTTP 200; signup content present
- `/confirmed`: HTTP 200; check-email content present
- Unauthenticated `/feed`: redirect to `/login` confirmed
- `/auth/callback` without a code: safe redirect to `/login?error=missing_code` confirmed

Headless Chrome rendered `/login` and `/signup` with expected content and no browser console-error signature. Development-server logs contained no warnings or errors during the route tests.

## Real authentication test

No real account credentials or PKCE authorization code were provided or used. A successful real login, signup email delivery, and callback completion were therefore not claimed. The implemented server actions, redirect behavior, public page rendering, unauthenticated guard, linting, types, and production build were validated.

## Packages

`npm install` reported the existing dependency tree as up to date. No new package or version was added in Step 3. The already-installed `@supabase/ssr`, `@supabase/supabase-js`, and `zod` packages power this foundation.

## Remaining warnings and blockers

No implementation blocker remains for Step 3.

`npm audit` still reports the same two moderate entries representing the transitive PostCSS advisory already documented in Step 2. There are zero high and zero critical findings. No forced breaking downgrade was applied.

Live login and email-confirmation behavior remains unverified until approved test credentials and a real callback are available. No successful authentication result has been invented.

## Scope confirmation

Confirmed by repository status: every workspace change is under `factfight-web/`.

No file was changed in:

- `app/`
- `components/`
- `services/`
- `context/`
- `hooks/`
- `backend/`
- `supabase/`
- `client/landing/`
- Root package or lock files
- Existing Expo configuration

No SQL was run. `supabase/sql/052_single_write_path_phase4_HOLD_DO_NOT_RUN.sql` was not executed or changed. No Supabase Dashboard, Render production setting, DNS, or deployment action occurred.

## Local testing command

From any PowerShell directory:

```powershell
npm.cmd --prefix C:\FactLens\factfight-web run dev
```

Then open `http://localhost:3000`.

Step 3 stops here. The real feed and claim migration were not started.
