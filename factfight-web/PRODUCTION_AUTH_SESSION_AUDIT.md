# FactFight production authentication and session audit

Audit date: 2026-07-20 (America/Chicago)

Production web: `https://factfight.com` / `https://www.factfight.com`

Production API: `https://factlens-e8uf.onrender.com`

Repository commit audited: `7c9ea4b30014fb61de3546453ea14fdd247a9f6f`

Status: code corrections are deployed, but production signup is **not fixed yet** because Supabase confirmation-email delivery is failing. A complete live signup, confirmation, authenticated vote, and password-reset test remains blocked until the Supabase SMTP problem is repaired.

## Active production deployment

- Host: Vercel (`fact-fight` project), not Render
- Production branch: `main`
- Previous live deployment: `dpl_CRSMS8owRBZZsHQekb6u9NQnBGHS`, Ready, corresponding to repository commit `7c9ea4b`
- Current deployed commit: `1e8b2be`; Vercel deployment `dpl_fQoLv6SqMEFu2QR32o8uGn1PPL1i`, Ready, aliasing both `factfight.com` and `www.factfight.com`
- Vercel production variables present: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_RENDER_BACKEND_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (all encrypted in the CLI output)
- Live HTML metadata and Vercel response headers were checked directly; the browser is serving the current Ready production deployment, not a stale local or preview build. The new fixes are in the current deployment.
- Post-deploy verification confirmed the new `/confirmed` resend form and the new safe signup failure message on `www.factfight.com`.

## Executive conclusions

Signup root cause, in one sentence: **Supabase Auth aborts signup because its confirmation-email delivery fails with HTTP 500 (`unexpected_failure`, `Error sending confirmation email`), so the web flow receives no session and cannot create the profile.**

Vote logout root cause, in one sentence: **the logged-out appearance came from treating a stale or rotated SSR auth cookie as unauthenticated during the post-vote refresh path, where a Server Component could not persist the rotated cookie and the proxy redirected to `/login` after `getClaims()` failed.**

The vote conclusion is supported by the before/after code in commit `7c9ea4b`, the fact that the exact commit is the current Vercel production deployment, and regression tests for the stale-cookie path. A logged-in live request/cookie trace could not be captured because no test credentials were provided and new-account creation is blocked by the SMTP failure. It must therefore be treated as strongly code-supported rather than a completed live reproduction.

## Production evidence

### Signup request and real upstream error

A controlled signup was attempted through the production page. The browser submitted a Next.js Server Action request:

- Browser URL: `https://www.factfight.com/signup`
- Browser method: `POST`
- Browser response: HTTP 200, because the Server Action returned its validation/error state in a successful Next.js response envelope
- Relevant browser console error: none; the server action handled the failure
- Vercel deployment: `dpl_CRSMS8owRBZZsHQekb6u9NQnBGHS`

Vercel production logs at `2026-07-21 03:50:51Z` and `03:57:04Z` contain:

```text
Supabase signup failed { code: 'unknown', message: '{}', status: 500 }
```

The same signup was checked directly against the Supabase Auth signup contract with generated test input and a redacted credential. The response was:

```json
{
  "httpStatus": 500,
  "ok": false,
  "errorCode": "unexpected_failure",
  "msg": "Error sending confirmation email",
  "userCreated": false,
  "confirmationSent": false
}
```

No password, access token, refresh token, email address, confirmation URL, or secret was logged or recorded in this report.

This evidence rules out username/profile RLS as the signup root cause: the failure occurs inside Supabase Auth while sending the confirmation email, before a session exists and before FactFight calls `/profile/ensure`. It also shows email signup is enabled, confirmation is required, and the request reached the email stage rather than failing CAPTCHA, redirect validation, or anon-key authorization.

The Supabase Dashboard and Auth Log Explorer were not accessible from the available CLI identity (`LegacyPlatformAuthRequiredError`). Therefore the provider-specific SMTP error, Auth user table, and profile row could not be independently inspected. The direct response reported `userCreated: false`; the Dashboard must still be checked after SMTP repair.

### Post-deploy live verification

After pushing commit `1e8b2be`:

- Vercel production deployment `dpl_fQoLv6SqMEFu2QR32o8uGn1PPL1i` reached Ready and aliases both production domains.
- A clean headless browser submitted one generated, non-personal signup through `https://www.factfight.com/signup`. The outer Server Action response was HTTP 200, the page stayed on `/signup`, the specific message `confirmation email could not be sent` rendered, and the old generic message did not render.
- The corresponding Vercel log contains only redacted diagnostics: `category: 'supabase_auth_service_failure', status: 500`; no email, password, or token was logged.
- Render auto-deployed the backend change. Live CORS now returns the exact requesting origin for `https://factfight.com`, `https://www.factfight.com`, and `http://localhost:3000`, while `https://evil.example` receives HTTP 400 with no allow-origin header.
- This confirms the deployed diagnostic and CORS/session-protection changes. It does **not** prove signup, confirmation, login, voting, or reset success because Supabase still rejects confirmation-email delivery.

### Signup implementation

The web signup is a Next.js Server Action. It first calls Render for username availability, then calls Supabase directly:

```ts
const { data, error } = await supabase.auth.signUp({
  email: parsed.data.email,
  password: parsed.data.password,
  options: {
    emailRedirectTo: `${publicEnvironment.siteUrl}/auth/callback`,
    data: {
      username: parsed.data.username,
      displayName: parsed.data.displayName,
    },
  },
});
```

`publicEnvironment.siteUrl` is validated from `NEXT_PUBLIC_SITE_URL`. The production page emits canonical and Open Graph URLs for `https://factfight.com`, proving the deployed site value resolves to the apex domain. Signup does not insert a profile row in the browser. The profile is created through authenticated Render `/profile/ensure` only after an immediate session or a successful PKCE callback.

### Confirmation, profile, and password reset

No confirmation email arrived, so there was no confirmation link host, `redirect_to`, live callback exchange, session persistence, or profile row to verify. No live password-reset email was requested after the signup failure to avoid generating more failing production email traffic.

The local code paths were verified:

- Signup callback: `${NEXT_PUBLIC_SITE_URL}/auth/callback`
- Resend callback: `${NEXT_PUBLIC_SITE_URL}/auth/callback`
- Password reset callback: `${NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`
- Callback exchanges the PKCE code with `exchangeCodeForSession`
- `next` is restricted to a relative internal path; schemes, scheme-relative URLs, backslashes, and control characters are rejected
- `/reset-password` validates claims before allowing `updateUser`
- Successful password update deliberately signs out and returns to login; this is intentional, not an error-driven logout

### Vote status and session evidence

The web vote is a Server Action. The browser sends the action to Next.js; therefore a bearer header is intentionally **not** visible on the browser-to-Vercel request. Vercel validates the cookie session, reads the access token only as transport after `getClaims()`, and sends the server-to-server Render request with:

```text
Authorization: Bearer <redacted access token>
Content-Type: application/json
```

The request body contains only `vote_type`; it never accepts or sends a frontend `user_id`. Render derives the user from the verified bearer token.

An unauthenticated contract probe produced the exact safe backend response:

```text
POST https://factlens-e8uf.onrender.com/api/claims/00000000-0000-0000-0000-000000000000/vote
HTTP 401
{"detail":"Authentication required."}
```

That is not represented as the previously reported logged-in failing vote. The exact logged-in status, pre/post cookies, and Render request log could not be captured without a valid production session. No success is claimed.

The current production deployment already contains commit `7c9ea4b`, which added one refresh after a failed `getClaims()` in both the verified-session helper and proxy. This audit adds the missing API-level behavior: on the first Render 401, a Server Action force-refreshes and validates the cookie-backed session, retries the vote exactly once with the rotated bearer token, and then shows `Your session could not be verified. Please sign in again.` if the retry is also 401. No vote failure calls `signOut`.

## Domain and URL audit

| Location | Current value/evidence | Expected value | Action required |
| --- | --- | --- | --- |
| Vercel `NEXT_PUBLIC_SITE_URL` | Encrypted variable exists; live canonical metadata is `https://factfight.com` | `https://factfight.com` | No code change; verify exact value in Vercel Dashboard before redeploy |
| Vercel `NEXT_PUBLIC_RENDER_BACKEND_URL` | Encrypted variable exists; signup reached the Render username check before Supabase | `https://factlens-e8uf.onrender.com` | Verify exact encrypted value in Vercel Dashboard; do not change backend URL |
| Vercel Supabase variables | URL and anon-key variables exist; local web values match the Expo project without printing either value | Existing FactLens Supabase project | Verify production values in Vercel Dashboard; never add service-role credentials |
| Local `.env.local` | Site is `http://localhost:3000`; Render URL is correct; public Supabase values match mobile | Development values | Correct and ignored by Git |
| Web signup | Environment-driven `/auth/callback` | Apex callback | Correct |
| Web resend | Environment-driven `/auth/callback` | Apex callback | Added |
| Web password reset | Environment-driven `/auth/callback?next=/reset-password` | Apex reset callback | Correct |
| Web callback | Fixed canonical origin plus safe internal destination | No arbitrary redirect | Correct |
| Web metadata | `metadataBase` is environment-driven; live canonical is apex | Apex | Correct |
| Domain routing | Apex returns HTTP 308 to `www`, preserving the query string; `www` returns HTTP 200 | One intentional canonical host | Add both hosts to Supabase redirects now; later choose one Vercel primary-domain direction to avoid the extra bounce |
| Backend `PUBLIC_SITE_URL` default | Changed from the obsolete domain to `https://factfight.com`; legacy environment name still accepted | FactFight | Set `FACTFIGHT_PUBLIC_SITE_URL=https://factfight.com` on Render and remove an obsolete `VERIFACT_PUBLIC_SITE_URL` value only after confirming legacy pages |
| Live Render CORS | HTTP 200 and `Access-Control-Allow-Origin: *` for FactFight, `www`, localhost, and an unapproved origin; credentials are false | Explicit allowed origins | Fixed in source; deploy Render and verify live |
| Supabase URL Configuration | Dashboard not accessible during audit | Values listed below | Manual Dashboard action required |

### Remaining `verifact.pennyfloat.com` occurrences

Active obsolete references changed:

- `backend/main.py`: default public/share URL changed to `https://factfight.com`; `FACTFIGHT_PUBLIC_SITE_URL` is now the preferred Render setting.
- `backend/services/source_page_fetcher.py`: active bot identity changed to `FactFightBot` at `factfight.com`.
- `backend/services/citation_service.py`: active bot identity changed to `FactFightBot` at `factfight.com`.
- `client/landing/index.html`: obsolete target copy changed to FactFight.
- `verifact-terms-of-service.html`: website and privacy links changed to FactFight.
- `docs/supabase-auth-verification-setup.md`: production Site URL and web callback/reset instructions changed to FactFight; current mobile redirects were preserved explicitly.

Intentionally preserved legacy occurrences:

- `constants/launchConfig.ts` lines 1, 4, and 6: the live Expo app still uses the old HTTPS callback while its share URL is already FactFight. This audit did not modify mobile configuration.
- `docs/supabase-auth-verification-setup.md` lines 31-33: preserved legacy web/mobile callback and recovery redirects that must remain in the Supabase allow-list.
- `backend/main.py` legacy CORS origin and `backend/tests/test_auth_cors.py`: the old site remains an explicitly allowed migration origin.
- `docs/phase5-step5-store-branding-assets.md`: historical mobile store submission URLs, including pages not yet implemented on FactFight web.
- `scripts/build-landing.mjs`: legacy landing-build comment.
- `services/claimService.ts`: comments documenting old `share_url` values already stored in the database; runtime URLs are rebuilt with FactFight.
- `factfight-web/PHASE_A_REPORT.md` and `factfight-web/MIGRATION_AUDIT.md`: historical migration and rollback records.
- `factfight-web/PRODUCTION_AUTH_SESSION_AUDIT.md`: this audit record and its required preserved redirect list.
- `factfight-web/src/lib/utils/auth-config.test.ts`: a regression assertion that active web auth source must not contain the obsolete domain.

No active FactFight web auth source generates `verifact.pennyfloat.com`.

## Required Supabase Dashboard configuration

In Supabase Dashboard, open **Authentication → URL Configuration**.

Site URL:

```text
https://factfight.com
```

Exact production redirect URLs:

```text
https://factfight.com/auth/callback
https://factfight.com/auth/callback?next=/reset-password
https://www.factfight.com/auth/callback
https://www.factfight.com/auth/callback?next=/reset-password
```

The `www` entries are required because production currently redirects apex to `www`. Development may include:

```text
http://localhost:3000/auth/callback
http://localhost:3000/auth/callback?next=/reset-password
```

Keep these current mobile/legacy entries:

```text
https://verifact.pennyfloat.com/auth/callback
https://verifact.pennyfloat.com/reset-password
https://verifact.pennyfloat.com/auth/reset-password
verifact://auth/callback
exp+factlens://auth/callback
exp+verifact://auth/callback
```

Do not add a broad production wildcard. Supabase recommends exact production redirect paths in its [redirect URL documentation](https://supabase.com/docs/guides/auth/redirect-urls).

### SMTP repair required before retesting

1. Open **Logs → Auth** (or Log Explorer filtered to Auth) around `2026-07-21 03:50Z–03:58Z` and expand the HTTP 500 rows.
2. Record the provider error without copying an API key or complete confirmation URL.
3. Open **Authentication → SMTP Settings** and confirm custom SMTP is enabled for production.
4. Verify SMTP host, TLS-compatible port, username, API key/password, From address, and From name.
5. In the mail provider, verify the FactFight sending domain, SPF/DKIM/DMARC state, suppression list, quota/rate limit, and provider status.
6. Validate both confirmation and password-reset templates. A malformed template can also cause a 500.
7. Send one controlled confirmation email, inspect Supabase Auth logs and provider delivery logs, then perform the complete live test matrix.

Supabase documents that production apps should use [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) and that Auth 500s commonly come from external database/SMTP dependencies; its [500 troubleshooting guide](https://supabase.com/docs/guides/troubleshooting/resolving-500-status-authentication-errors-7bU5U8) specifically identifies SMTP domain, port, rate limit, provider downtime, and template problems. Do not disable confirmation to mask the failure.

## Auth/session architecture audit

- Browser client: `createBrowserClient`, now memoized once at module scope.
- Server client: per-request `createServerClient` using asynchronous `cookies()` and `getAll`/`setAll`.
- Next.js 16 proxy: `src/proxy.ts`; there is no `middleware.ts`.
- Proxy auth validation: `getClaims()`, then one safe refresh before redirecting protected routes.
- Proxy cookie writes: refreshed cookies are copied to both request and response, and redirects now retain `HttpOnly`, `Secure`, `SameSite`, path, expiry, and other cookie options.
- Protected server components: use `getClaims()` for identity. Where an access token is needed for Render, `getSession()` is used only after verified claims and only as token transport.
- Auth callback: exchanges the code, validates claims, ensures a profile, accepts terms, and redirects only to a safe internal path.
- Error behavior: login/profile/terms/callback infrastructure failures no longer call `signOut`; explicit logout, successful password-reset logout, and account-deletion cleanup remain intentional.
- Web auth listener: none exists. The web app is SSR/cookie driven, so React auth-event subscription duplication is not applicable. Token refresh is performed by the proxy/server action and covered by tests.
- Expo listener (read-only audit): the existing provider handles `SIGNED_OUT` explicitly, applies all other session events (including refresh/update/initial session) without clearing state, installs one subscription in an effect, and unsubscribes during cleanup. No Expo file was changed.
- Cache/refresh: Render requests use `cache: "no-store"`; voting revalidates the affected claim/feed paths, then the client uses `router.refresh()`. No auth provider/store is invalidated or replaced.
- Backend identity: Render parses `Authorization: Bearer`, validates it against the configured Supabase project via Auth `get_user`, derives the user ID server-side, and never accepts browser identity fields for voting.
- Backend vote errors: expired/invalid tokens return a safe 401; vote failures do not revoke refresh tokens or call Supabase sign-out.

Supabase’s [SSR client guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client) confirms that the proxy must write refreshed cookies to both the request and response because Server Components cannot persist refresh cookies themselves.

## Findings and remediation status

### FF-AUTH-001 — High — production confirmation email prevents every new signup

- Location/evidence: `src/app/(auth)/actions.ts:151`; Vercel `POST /signup` logs show Supabase status 500; direct Auth response is `unexpected_failure` / `Error sending confirmation email`.
- Impact: new accounts, confirmation, profile creation, and first login cannot complete.
- Code mitigation: specific safe UI feedback and a resend action were added.
- Required remediation: repair Supabase SMTP/provider/template configuration and verify with a real account.
- Status: **open production blocker**.

### FF-AUTH-002 — High — stale SSR cookie was interpreted as logout after voting

- Location/evidence: `src/lib/auth/verified-session.ts:41` and `src/app/claim/[id]/actions.ts:69`; pre-fix code returned unauthenticated immediately after `getClaims()` failure; commit `7c9ea4b` added refresh recovery, and the Vercel production deployment was created seconds after that commit.
- Impact: a valid user could be redirected to login after a successful mutation and refresh.
- Remediation: retain the existing claims-refresh recovery; add force-refresh plus one vote retry on backend 401; never call sign-out for vote errors.
- Status: fixed locally and regression-tested; complete live vote proof remains blocked.

### FF-AUTH-003 — High — redirect path discarded refreshed cookie attributes

- Location/evidence: `src/lib/supabase/proxy.ts:8`, `:23`, and `:87`; the proxy previously copied cookies from `response.cookies.getAll()` into a new redirect response, which retained name/value but not original options.
- Impact: refreshed auth cookies could lose security/lifetime attributes on an unauthenticated redirect.
- Remediation: retain the original Supabase `cookiesToSet` values and apply name, value, and all options to the redirect.
- Status: fixed locally and tested.

### FF-AUTH-004 — Medium — live Render CORS is wildcard

- Location/evidence: `backend/main.py:121` and `:2036`; live preflight from FactFight, `www`, localhost, and `https://evil.example` all returns `Access-Control-Allow-Origin: *`. Credentials are false, so this is not wildcard credentialed CORS.
- Impact: unnecessary cross-origin browser access to public/bearer APIs and a wider abuse surface.
- Remediation: explicit production, legacy, and local origins with narrow methods/headers; optional `CORS_ALLOWED_ORIGINS` for exact previews.
- Status: deployed and live verification passed.

### FF-AUTH-005 — Medium — valid sessions were cleared after profile/terms infrastructure failures

- Location/evidence: `src/app/(auth)/actions.ts:100-117` and `:179-198`, plus `src/app/auth/callback/route.ts:28-49`; those paths called `signOut()` when claims/profile/terms setup returned an error.
- Impact: a temporary backend/data failure could erase a valid Supabase session and appear as an authentication failure.
- Remediation: remove those automatic sign-outs. Explicit user logout and deliberate post-password-reset logout remain.
- Status: fixed locally and tested.

### FF-AUTH-006 — Medium — `www` is the active host but canonical configuration is apex

- Location/evidence: live HTTP headers plus `src/app/layout.tsx:10`; `https://factfight.com/...` returns HTTP 308 to `https://www.factfight.com/...`, preserving query parameters, while metadata is apex.
- Impact: extra auth redirect bounce and callback failure if only apex is allow-listed.
- Remediation: allow-list both hosts now; later make the Vercel primary-domain redirect agree with the intended apex canonical.
- Status: manual configuration required.

### FF-AUTH-007 — Low — signup hid the actionable failure as `{}`/generic copy

- Location/evidence: `src/app/(auth)/actions.ts:35-75`; Supabase SDK serializes the retryable 500 response as `{}` in this path.
- Impact: users and operators could not distinguish invalid input from an email-infrastructure outage.
- Remediation: map the 500 to safe confirmation-email service copy and log only code/category/status, never raw credentials or tokens.
- Status: fixed locally.

### FF-AUTH-008 — Low — browser client factory was not memoized

- Location/evidence: `src/lib/supabase/client.ts:7-16`; each call previously returned a new `createBrowserClient` instance.
- Impact: future client components could accidentally multiply listeners/session state.
- Remediation: one module-scoped browser client.
- Status: fixed locally and tested.

### FF-SEC-009 — Medium — no Content Security Policy

- Location/evidence: `next.config.ts:31-43` and live response headers; production has HSTS, `X-Content-Type-Options`, frame denial, referrer and permissions policies, but no CSP header.
- Impact: reduced defense in depth against script injection.
- Remediation: add a nonce-based Next.js CSP in a separate change and validate all Next/Image/Supabase origins. Do not deploy a permissive or untested policy.
- Status: open hardening item; not the cause of signup or vote logout.

### FF-DEP-010 — Medium — transitive PostCSS advisory remains

- Evidence: `npm audit` reports two moderate entries representing `GHSA-qx2v-qp2m-jg93` beneath the current Next.js version; zero high and zero critical findings.
- Remediation: upgrade when a compatible patched Next.js release is available. npm currently proposes an invalid breaking downgrade, so `--force` was not used.
- Status: open dependency warning.

## Automated and live test matrix

| # | Test | Result |
| --- | --- | --- |
| 1 | New signup with unique email | **Live failed:** Supabase email-send HTTP 500; unit contract passed |
| 2 | Confirmation callback | Unit passed; live blocked because no email/code |
| 3 | Resend confirmation | Added; unit and local route smoke passed; live email blocked by SMTP |
| 4 | Login | Unit passed; no live credentials supplied |
| 5 | Browser refresh while logged in | Proxy/session regression passed; live blocked |
| 6 | Vote while logged in | Server Action/auth-header unit passed; live blocked |
| 7 | Vote HTTP 400 | Passed; safe backend message preserved, no auth refresh/sign-out |
| 8 | Vote HTTP 401, refresh succeeds | Passed; exactly one refresh and one retry |
| 9 | Vote HTTP 401, retry fails | Passed; exact session message, no loop/sign-out |
| 10 | Vote HTTP 403 | Passed; safe backend message preserved |
| 11 | Vote HTTP 409 | Passed; duplicate/closed message preserved |
| 12 | Vote HTTP 500 | Passed; safe backend message preserved |
| 13 | Non-success responses never silently sign out | Passed by action tests and source invariant test |
| 14 | Token refresh event | Web has no auth listener; equivalent proxy/server refresh lifecycle passed. Existing Expo listener was read-only audited |
| 15 | Password-reset callback | Unit passed; live email/update blocked |
| 16 | Safe next-path validation | Passed for valid paths and external/scheme-relative/backslash/control-character rejection |
| 17 | Obsolete-domain search | Passed for active web auth source; all repository occurrences classified above |
| 18 | `www` versus apex canonical behavior | Live passed: apex 308 → `www`, query preserved; metadata remains apex |
| 19 | Mobile callback URLs remain untouched | Passed; three Expo schemes and old HTTPS callbacks preserved |
| 20 | Session through navigation and `router.refresh()` | Proxy cookie and vote revalidation regressions passed; live blocked |

Additional results:

```text
npm test:       8 files passed, 43 tests passed
npm run lint:   pass, no warnings/errors
npm run typecheck: pass
npm run build:  pass, Next.js 16.2.10 production build
pytest backend/tests: 35 passed
git diff --check: pass
```

Local production route smoke tests:

- `/confirmed`: HTTP 200 and resend form rendered
- `/auth/callback` without a code: HTTP 307 to `/login?error=missing_code`
- unauthenticated `/feed`: HTTP 307 to `/login?next=%2Ffeed`

## Files changed

Production web/auth:

- `factfight-web/src/app/(auth)/actions.ts`
- `factfight-web/src/app/(auth)/confirmed/page.tsx`
- `factfight-web/src/app/(auth)/password-actions.ts`
- `factfight-web/src/app/auth/callback/route.ts`
- `factfight-web/src/app/claim/[id]/actions.ts`
- `factfight-web/src/components/auth/resend-confirmation-form.tsx`
- `factfight-web/src/lib/api/claim-mutations.ts`
- `factfight-web/src/lib/auth/verified-session.ts`
- `factfight-web/src/lib/supabase/client.ts`
- `factfight-web/src/lib/supabase/proxy.ts`
- `factfight-web/package.json`
- `factfight-web/package-lock.json`

Backend/domain:

- `backend/main.py`
- `backend/services/citation_service.py`
- `backend/services/source_page_fetcher.py`
- `client/landing/index.html`
- `verifact-terms-of-service.html`
- `docs/supabase-auth-verification-setup.md`

Tests/configuration:

- `factfight-web/vitest.config.ts`
- `factfight-web/src/test/server-only.ts`
- `factfight-web/src/app/(auth)/auth-flows.test.ts`
- `factfight-web/src/app/auth/callback/route.test.ts`
- `factfight-web/src/app/claim/[id]/actions.test.ts`
- `factfight-web/src/lib/api/claim-mutations.test.ts`
- `factfight-web/src/lib/auth/verified-session.test.ts`
- `factfight-web/src/lib/supabase/client.test.ts`
- `factfight-web/src/lib/supabase/proxy.test.ts`
- `factfight-web/src/lib/utils/auth-config.test.ts`
- `backend/tests/test_auth_cors.py`

This report is `factfight-web/PRODUCTION_AUTH_SESSION_AUDIT.md`.

No Expo/mobile source, Supabase SQL/RLS, service-role credential, OpenAI credential, DNS record, or production environment was changed. No SQL was run.

## Production deployment and final verification steps

1. Repair SMTP and confirm the required Supabase URLs before deploying code, so production verification can complete immediately.
2. In Vercel Production, verify:
   - `NEXT_PUBLIC_SITE_URL=https://factfight.com`
   - `NEXT_PUBLIC_RENDER_BACKEND_URL=https://factlens-e8uf.onrender.com`
   - the public Supabase URL and anon key match the mobile FactLens project
3. In Render, set `FACTFIGHT_PUBLIC_SITE_URL=https://factfight.com`. Optionally set `CORS_ALLOWED_ORIGINS` to an exact comma-separated list if approved preview origins are required.
4. Commit and push `main`. Vercel should deploy `factfight-web`; Render should deploy backend changes from the same commit.
5. Verify live CORS: both FactFight origins allowed; an unapproved origin must not receive `Access-Control-Allow-Origin`.
6. Create one brand-new account on `www.factfight.com` and record the browser request, Vercel log, Supabase Auth log, provider delivery log, callback host, final cookies, Auth user, and profile row.
7. Refresh and navigate while signed in.
8. Vote on a real claim and record the browser Server Action, Vercel server-to-server status, cookies before/after, refreshed page, and subsequent navigation.
9. Test wrong/expired token behavior and safe 400/403/409/429/500 messages without automatic logout.
10. Request a password reset, complete `/auth/callback?next=/reset-password`, update the password, and log in with the new password.

Completed deployment record for this audit:

```text
Commit: 1e8b2be
Push: origin/main completed
Vercel: dpl_fQoLv6SqMEFu2QR32o8uGn1PPL1i (Ready)
Render: auto-deployed; explicit CORS live check passed
Expo rebuild/EAS Update: not run; no mobile files changed
```

Recommended commit message:

```text
fix: stabilize web auth callbacks and prevent vote actions from clearing sessions
```

Do not mark the production incident closed until the live signup, email delivery, callback, profile creation, session refresh/navigation, authenticated vote, and password reset all pass with evidence.
