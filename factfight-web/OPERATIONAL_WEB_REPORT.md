# FactFight operational web application report

Date: 2026-07-16

Status: browser application implementation complete for the planned route set; production deployment and DNS remain intentionally pending.

## Outcome

`factfight-web/` is no longer a scaffold or read-only public site. It now contains the complete planned Next.js route set and the primary user, safety, account, and moderator workflows needed to operate FactFight in a browser.

The existing Expo application, Render backend, Supabase schema/migrations, legacy Verifact site, DNS, and production deployments were not changed.

## Operational routes

Public routes:

- `/`
- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password` after a valid recovery callback
- `/auth/callback`
- `/claim/[id]` and claim SEO slugs
- `/profile/[username]`
- `/topic/[slug]`
- `/privacy`
- `/terms`
- `/robots.txt`
- `/sitemap.xml`

Authenticated routes:

- `/feed`
- `/create`
- `/search`
- `/leaderboard`
- `/profile`
- `/profile/claims`
- `/profile/saved`
- `/notifications`
- `/settings`
- `/settings/blocked`

Admin-only route:

- `/moderation`

The Next.js 16 proxy refreshes cookie-backed Supabase sessions with `auth.getClaims()` and returns an HTTP 307 login redirect before protected route rendering when no verified claims are present.

## User workflows implemented

- Cookie-backed Supabase SSR login, signup, logout, email callback, and protected routes.
- Neutral, non-enumerating forgot-password request and recovery-session password update.
- Current-password verification before changing a password from Settings.
- Responsive desktop sidebar and mobile bottom navigation.
- Authenticated feed with blocked-author filtering.
- Claim creation through authoritative Render `POST /api/claims`.
- Claim source, optional video, optional JPG/PNG/WebP image, category, politics focus, and permanence confirmation.
- Public claim pages with source, media, evidence, public vote totals, server verdict, and AI risk signal.
- One-time voting through authoritative Render `POST /api/claims/{id}/vote`.
- Evidence submission under authenticated Supabase RLS, including optional images in the existing `evidence-images` bucket.
- Saved claims, saved-claim removal, and personal claim lists.
- Claim reporting with the existing report reason contract and daily limit.
- Author-only claim removal through authoritative Render `DELETE /api/claims/{id}`; the backend retains the 3-hour/finalization guard.
- Claims, topics, and contributor search.
- Public contributor profiles and server-calculated leaderboard values.
- Profile display name, bio, and privacy controls through Render `PATCH /profile`.
- User blocking/unblocking through Render, with blocked users removed from the feed.
- User-scoped notifications and mark-read controls under RLS.
- Account deletion through Render `/account`, including explicit `DELETE` confirmation and local sign-out.
- Server-authorized moderation identity, metrics, open reports, report decisions, and optional target hiding.
- Responsive privacy and terms pages plus public footer navigation.

## Authority and security boundaries

- Claim creation, voting, claim deletion, blocking, profile protection, account deletion, and moderation actions use the existing Render backend.
- Evidence, reports, saved claims, notification updates, and storage uploads use the authenticated user's Supabase session and existing RLS/storage policies.
- Browser forms never accept or submit `trust_score`, `trust_weight`, `weighted_community_score`, `final_score`, reputation calculations, admin roles, AI results, or moderation outcomes.
- Final scores and reputation values are read-only server output.
- AI remains labeled and rendered only as a risk signal, never as the final judge.
- `auth.getClaims()` is the authorization decision. `auth.getSession()` is used only after that validation to obtain the current bearer token for Render.
- User uploads are restricted to JPG, PNG, and WebP, a 5 MB maximum, and user-owned storage paths.
- No service-role, OpenAI, or internal backend secret is referenced by runtime source.
- External redirect inputs are restricted to relative internal paths.
- `/moderation` redirects non-admin users after the Render backend rejects `/admin/me`; every moderator mutation is independently authorized again by Render.

## Configuration changes

No package was added or upgraded.

`next.config.ts` now permits Server Action request bodies up to 6 MB so the application can accept a validated image of at most 5 MB. This uses Next.js's `experimental.serverActions.bodySizeLimit` setting and is the reason the production build prints the expected Server Actions experiment notice.

## Commands executed

```text
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd audit --json
npm.cmd run start -- --hostname 127.0.0.1 --port 3100
```

Additional validation used route-level HTTP requests, a real anonymous read of a currently visible claim, targeted source scans, ignored-environment verification, and repository-scope checks.

## Final verification results

Lint: pass, no warnings or errors.

```text
eslint .
Exit code: 0
```

TypeScript: pass.

```text
tsc --noEmit
Exit code: 0
```

Production build: pass.

```text
Next.js 16.2.10 (Turbopack)
Compiled successfully
All listed application routes compiled
Proxy entry compiled
Exit code: 0
```

Public route smoke tests returned HTTP 200 for `/`, `/login`, `/signup`, `/forgot-password`, `/privacy`, `/terms`, `/robots.txt`, and `/sitemap.xml`.

Unauthenticated requests returned HTTP 307 with a safe internal `next` destination for `/feed`, `/create`, `/search`, `/leaderboard`, `/profile`, `/settings`, `/settings/blocked`, `/notifications`, and `/moderation`.

`/reset-password` without a recovery session safely redirected to `/forgot-password`. `/auth/callback` without a code safely redirected to the fixed missing-code login state.

A current public claim at `/claim/6e793cc9-b893-4efe-8af7-4a7a4b33b294` returned HTTP 200 and rendered the voting state, evidence form, save control, report control, and AI signal. This was a read-only smoke test; no production data was mutated.

An unsafe login destination such as `https://example.com` was rejected and replaced with `/feed`; a valid relative claim path was preserved.

Source scans confirmed:

- No React Native, Expo Router, or AsyncStorage code in the web source.
- No privileged secret variable references in runtime source.
- No browser write path for authoritative scoring or reputation fields.
- `.env.local` remains ignored.
- Every repository change is inside `factfight-web/`.

## Tests requiring approved credentials or release configuration

No real user or admin credentials were provided, so the following live mutations were not claimed as executed:

- Successful signup email delivery and callback completion.
- Successful login with a real account.
- Claim, vote, evidence, report, block, profile, password, and account-deletion mutations.
- Authenticated storage uploads.
- Admin report resolution with a real admin role.

The code paths, validation, authorization boundaries, compilation, public reads, and unauthenticated guards were verified. A staging acceptance pass with dedicated test accounts is still required before production release.

## Remaining warnings

`npm audit` reports the same two moderate entries already documented in Steps 2 and 3: one transitive PostCSS advisory through the installed latest stable `next@16.2.10`. There are no high or critical findings. npm's proposed fix is an invalid breaking downgrade to Next 9, so no forced audit fix was applied.

The build prints the expected experimental Server Actions notice because of the explicit upload body-size limit.

## Production release boundary

No deployment, DNS, Render setting, Supabase Dashboard setting, or old-site cutover was performed.

Before real users can access FactFight publicly, a separately approved release must:

1. Deploy `factfight-web` to an approved preview/staging host.
2. Set the four public environment variables for that host.
3. Change `NEXT_PUBLIC_SITE_URL` from localhost to the approved host.
4. Add that host's `/auth/callback` URL to the Supabase Auth redirect allowlist.
5. Run staging acceptance with normal, blocked, suspended, deleted, and admin test accounts.
6. Review storage uploads, RLS behavior, email recovery, responsive layouts, accessibility, and moderator actions.
7. Approve the later production domain/DNS cutover without removing the existing Verifact endpoint.

## Local command

From any PowerShell directory:

```powershell
npm.cmd --prefix C:\FactLens\factfight-web run dev
```

Then open `http://localhost:3000`.
