# FactFight web migration audit

Audit date: 2026-07-15

Repository: `C:\FactLens`

Target application: `factfight-web`

Status: discovery only; no web application implementation, DNS change, database migration, or production deployment has been performed.

## 1. Executive summary

FactLens is currently an Expo Router application backed by the existing Supabase project and the FastAPI service deployed at `https://factlens-e8uf.onrender.com`. The mobile UI is under `app/`; shared mobile components, contexts, services, domain types, utilities, and design tokens live at the repository root. The legacy public web pages are static HTML served both from the backend and from `client/landing`.

The repository did not contain a `factfight-web` application before this audit. This document is the only file added for the first task.

The migration should be a new Next.js App Router client for the existing platform, not a backend or database replacement. Most domain concepts and endpoint contracts can be recreated. React Native components, Expo navigation, native image handling, and AsyncStorage-based auth cannot be copied directly into Next.js.

The most important boundary is authoritative scoring and moderation:

- AI remains a risk signal and never becomes the final verdict.
- The intended score contract already appears in `constants/verificationConfig.ts` and `services/verificationEngine.ts` as 40% AI confidence and 60% weighted community score.
- The mobile code also contains legacy client-side score/finalization helpers and direct Supabase mutation fallbacks. These must not be ported into FactFight.
- FactFight must treat `trust_score`, `trust_weight`, `weighted_community_score`, `final_score`, reputation fields, and moderation decisions as read-only server output.
- New claims must use `POST /api/claims`; votes must use `POST /api/claims/{claim_id}/vote`; admin operations must use authenticated Render endpoints.

## 2. Existing frontend architecture

| Area | Existing location | Current responsibility | Web migration decision |
| --- | --- | --- | --- |
| Mobile routes | `app/` | Expo Router screens and layouts | Leave untouched; use only as product behavior reference |
| Mobile components | `components/` | Claim, evidence, voting, moderation, navigation, and state UI | Recreate semantically with React DOM and Tailwind |
| Global state | `context/AuthContext.tsx`, `context/ClaimsContext.tsx`, `context/DisplaySettingsContext.tsx` | Session, profile, claims, saved items, blocks, realtime, display settings | Split between server components, small client providers, and query-local state |
| Supabase client | `lib/supabase.ts` | Single React Native client using AsyncStorage | Do not copy; create separate browser, server, and middleware clients using cookies |
| API configuration | `constants/apiConfig.ts` | Resolves the Render base URL | Recreate with validated Next.js environment variables and no hardcoded fallback |
| API/data services | `services/` | Mix of direct Supabase access and Render `fetch` calls | Port contracts and mappers selectively; centralize authenticated requests |
| Domain types | `types/claim.ts`, `types/user.ts`, `types/verification.ts` | Claim, evidence, report, profile, vote, and verification models | Recreate in web-owned types; separate read models from mutation DTOs |
| Pure utilities | `utils/` and selected `services/` files | URL, media, mentions, username, source labels, claim quality, time/status formatting | Port pure functions after removing React Native and write-side dependencies |
| Design tokens | `constants/theme.ts` | Current Verifact light/dark colors, spacing, radii, and typography | Translate the light palette into CSS variables and Tailwind tokens |
| Static legacy site | `client/landing/` and backend HTML builders | Current landing, legal, auth callback, and claim-share pages | Keep live and unchanged until FactFight is separately validated |
| Backend | `backend/main.py` | FastAPI API, admin authorization, AI, service-role operations, public HTML | Continue using it; do not move its privileged logic into Next.js client code |
| Database migrations | `supabase/sql/` | Existing schema, RLS, RPCs, storage policies, moderation, and scoring | Do not run or alter for this audit |

### Existing mobile route inventory

- Main tabs: feed, claim detail, create, leaderboard, notifications, profile, search, and trending.
- Authentication: combined login/signup, callback, confirmed, and verify-email screens.
- Account: settings, blocked users, saved claims, and my claims.
- Public discovery: public profile by slug, user by id, organization by slug, and topic cluster.
- Administration: one consolidated moderation screen at `app/admin/moderation.tsx`.
- Legal: AI disclaimer, community guidelines, copyright, privacy, and terms.

### Existing API utility pattern

There is no single general-purpose API client. Individual service files obtain a Supabase session, construct a bearer header, call the Render URL, parse JSON, and map errors independently. Direct Supabase reads and mutations are interleaved with Render requests.

Relevant service contracts include:

- Claims: `services/claimService.ts`
- Votes: `services/voteService.ts`
- Evidence: `services/evidenceService.ts`
- Reports: `services/reportService.ts`
- Profiles and usernames: `services/profileService.ts`, `services/publicProfileService.ts`
- Auth profile mapping: `services/authProfile.ts`
- Content safety and AI precheck: `services/contentSafetyService.ts`, `services/aiPrecheckService.ts`
- Moderation and appeals: `services/moderationService.ts`, `services/appealService.ts`
- Leaderboard and reputation: `services/leaderboardService.ts`, `services/reputationEventService.ts`
- Mentions, topics, organizations: `services/mentionService.ts`, `services/topicService.ts`, `services/organizationService.ts`
- Blocks, saved claims, notifications: `services/blockService.ts`, `services/claimService.ts`, `services/notificationService.ts`
- Realtime: `services/realtimeService.ts`
- Storage: `services/imageUploadService.ts`

FactFight should replace this repetition with a web-owned API adapter that supports public requests, authenticated bearer requests, typed responses, timeouts, and normalized user-friendly errors.

## 3. Existing types and authoritative fields

### Reusable domain models

`types/claim.ts` defines:

- `Claim`, `ClaimStatus`, `ClaimType`, and `ClaimMedia`
- `VoteOption` and `ClaimVote`
- `Evidence` and `EvidenceType`
- `Report` and `ReportReason`
- `AiCheck`

`types/user.ts` defines the public/application `User` model, including profile, reputation, trust, badge, deletion, suspension, and admin display fields.

`types/verification.ts` defines verification modes, roles, inputs, votes, and results.

`services/profileService.ts`, `services/leaderboardService.ts`, `services/appealService.ts`, `services/moderationService.ts`, and `services/notificationService.ts` contain additional API-specific row and response types.

### Web type rule

Do not copy the existing broad models into form inputs. FactFight should have separate types for:

- Server/database read models.
- Public safe view models.
- User-authored mutation inputs.
- Render endpoint request and response contracts.

The following fields may be rendered when returned by a trusted server but must never be accepted from a browser mutation DTO:

- `trust_score`
- `trust_weight`, `trust_weight_override`
- `weighted_community_score`
- `final_score`
- `reputation_score`, `reputation_points`, rank, badge, and reputation delta fields
- Admin status, moderation outcomes, hide/delete/suspension audit fields
- AI result fields generated by backend processing

## 4. Components to recreate for Next.js

The following components have useful product behavior and presentation logic, but their JSX and styles must be rewritten for the DOM.

| Existing component | Recreate as | Notes |
| --- | --- | --- |
| `ClaimCard` | `components/claims/claim-card.tsx` | Preserve hierarchy, author link, media, badges, vote summary, report/save/menu behavior, and responsive card layout |
| `ClaimMedia` | `components/claims/claim-media.tsx` | Use `next/image` where appropriate; preserve image, YouTube thumbnail, and safe external-link behavior |
| `ClaimQualityBox` | `components/claims/claim-quality-box.tsx` | Keep claim-type guidance separate from blocked safety messaging |
| `AiCheckBadge` | `components/claims/ai-risk-badge.tsx` | Label AI as a signal, never a verdict |
| `StatusBadge`, `VerdictBanner`, `PhaseStatusRow` | Claim status components | Render server-supplied status and score fields only |
| `VoteButtons`, `VoteBreakdownBars` | `components/voting/` | Submit through the Render vote endpoint; make optimistic state reversible |
| `SourceQualityBadge` | Evidence/source component | Reuse safe label mapping, not privileged scoring logic |
| `MentionText`, `MentionTextInput` | DOM mention renderer and combobox | Escape user content; implement accessible keyboard behavior |
| `ReportClaimFlow` | Dialog/form components | Keep user-owned report submission separate from admin decisions |
| `Header` | Responsive page header | Integrate with desktop sidebar and mobile top bar |
| `EmptyState`, `Loading`, `Skeleton` | `components/ui/` | Rebuild with semantic HTML and reduced-motion support |

### Pure logic that can be ported selectively

- Claim/media URL resolution from `utils/claimMedia.ts`, `utils/videoUrl.ts`, `utils/url.ts`, and `services/urlValidation.ts`.
- Claim quality and local deterministic safety guidance from `utils/claimQuality.ts`, `utils/claimSafety.ts`, and `utils/contentValidation.ts`.
- Username and public-profile normalization from `utils/username.ts` and `utils/publicProfile.ts`.
- Mention extraction/limits from `utils/mentions.ts`.
- Source display labels from `services/sourceQuality.ts`.
- Read-only reputation labels from `utils/reputation.ts`.
- Verification timing/status display helpers after removing any mutation or finalization behavior.

## 5. Expo-specific code that cannot be copied directly

- React Native primitives: `View`, `Text`, `ScrollView`, `SafeAreaView`, `TouchableOpacity`, `TextInput`, `Image`, `Modal`, `Alert`, `StyleSheet`, `Animated`, and `RefreshControl`.
- Expo Router navigation: `useRouter`, `useLocalSearchParams`, `useSegments`, tab layouts, and native route guards.
- Expo/native modules: Image Picker, Image Manipulator, vector icons, Status Bar, navigation bar, Linking, Safe Area, haptics, and keyboard-specific behavior.
- `lib/supabase.ts`: it depends on `react-native-url-polyfill`, AsyncStorage, and `detectSessionInUrl: false`.
- `context/DisplaySettingsContext.tsx` and `hooks/useTheme.ts`: they depend on React Native appearance/accessibility APIs.
- Mobile tab-bar visibility and scroll behavior from `TabBarVisibilityContext`.
- Native image compression/upload flow in `services/imageUploadService.ts`.
- Root Expo configuration and native assets in `app.json`, `eas.json`, `android/`, `ios/`, and `assets/`.

Web equivalents should use semantic HTML, CSS/Tailwind, accessible dialogs and menus, browser `File` APIs, a web image-processing strategy, Next.js navigation, and cookie-backed Supabase auth.

## 6. Existing authentication logic

The mobile app currently:

1. Creates one Supabase client with persisted AsyncStorage sessions.
2. Loads the initial session using `supabase.auth.getSession()`.
3. Tracks changes using `supabase.auth.onAuthStateChange()`.
4. Uses `signInWithPassword`, `signUp`, and `signOut`.
5. Checks backend username availability before signup.
6. Sends username/display metadata with signup.
7. Loads a `profiles` row and calls authenticated `POST /profile/ensure` when needed.
8. Rejects deleted profiles and exposes friendly user-facing auth errors.
9. Handles code/token callbacks in a client-side Expo callback screen.
10. Uses a client-side Expo route guard for protected screens.

FactFight should use Supabase SSR clients with cookies:

- Browser client for interactive auth and Realtime.
- Server client for authenticated server components and route handlers.
- Middleware session refresh plus server-side authorization checks.
- A Next.js `/auth/callback` route handler for the PKCE code exchange.
- Render bearer headers derived from the current user session, never from a service-role key.
- Server-side checks for `/create` and `/moderation`; client redirects are only UX.

The current mobile setting does not require email verification, but the web callback and redirect allowlist should still support verified-email and password-reset flows without assuming that configuration will remain unchanged.

## 7. Existing Supabase data used by screens

Legend: **Direct** means the current Expo client queries Supabase. **Backend** means the screen uses the Render API, which performs the database work. **Realtime** means a Supabase Postgres Changes subscription exists.

| Existing screen or flow | Tables/storage involved | Current access |
| --- | --- | --- |
| App bootstrap and auth | Supabase Auth users, `profiles` | Auth SDK + Direct + Backend `/profile/ensure` |
| Login/signup | Supabase Auth users, `profiles`, reserved identity tables, `user_blocks` terms fields | Auth SDK + Backend username/profile/terms routes |
| Feed | `claims`, `profiles`, `votes`, `saved_claims`, `notifications`, `user_blocks`; topic reads through `claim_topics` | Direct reads, Backend topic search, Realtime `claims` |
| Trending | `claims`, `profiles`, `votes`, `saved_claims`, `user_blocks` | Direct reads through `ClaimsContext` |
| Claim detail | `claims`, `profiles`, `votes`, `evidence`, `reports`, `saved_claims`, `claim_tags`, `evidence_tags`; claim/evidence storage | Direct reads and allowed user mutations, Backend privileged/enrichment calls, Realtime `claims`, `votes`, `evidence`, `reports` |
| Create claim | `claims`, `profiles`, `content_safety_blocks`, `claim_topics`, `claim_tags`; `claim-images` bucket | Backend authoritative claim creation and safety/duplicate processing; storage upload remains client-owned in mobile |
| Search | No data access is implemented in the current screen; it is a placeholder | None today; the feed separately uses public topic search |
| Leaderboard | `profiles` | Backend `/leaderboard` |
| Notifications | `notifications` | Direct user-scoped read/update under RLS |
| Current-user profile | `profiles`, `votes`, `reputation_events`; `profile-avatars` bucket | Direct reads/storage plus Backend profile, reputation, and account routes |
| Public profile/user | `profiles`, `claims`, `votes`, `reports` | Backend-first profile read with Direct fallback; Direct claim reads |
| Saved claims | `saved_claims`, `claims`, `profiles`, `votes` | Direct user-scoped reads and writes |
| My claims | `claims`, `profiles`, `votes` | Direct author-filtered reads |
| Blocked users/settings | `user_blocks`, `profiles` | Backend block list/mutations plus Direct profile lookup |
| Topic cluster | `claim_topics`, `claims`, `profiles`, `votes` | Backend public topic endpoints |
| Organization | `organizations` | Direct public read |
| Moderation | `reports`, `claims`, `evidence`, `profiles`, `moderation_appeals`, `user_blocks`, reputation/admin audit data | Backend only for admin reads and mutations |
| Legal screens | None | Static content |

Other existing schema objects relevant to later parity include `claim_seo`, `citation_disputes`, `claim_reputation_events`, `reputation_notification_events`, `moderation_blocklist`, `admin_users`, `verification_requests`, `reserved_people`, `reserved_brands`, and `identity_audit_logs`.

Existing public storage buckets are:

- `claim-images`
- `evidence-images`
- `profile-avatars`

The current mobile upload flow accepts common image formats, rejects originals over 10 MB, creates a 1280 px JPEG and a 400 px thumbnail, and stores user-scoped object paths. The browser implementation should preserve equivalent validation and path ownership without copying Expo image APIs.

## 8. Existing Render backend endpoints

Base URL: `https://factlens-e8uf.onrender.com`

### Public HTML and health

- `GET /`, `/about`, `/privacy`, `/personal-privacy`, `/terms`, `/copyright`, `/community-guidelines`
- `GET /assets/icon/icon.png`
- `GET /claim/{claim_id}`
- `GET /health`
- `GET /auth/callback`, `/auth/confirmed`, `/reset-password`, `/auth/reset-password`

### Public product reads and checks

- `GET /public-profile/{identifier}`
- `GET /search/mentions`
- `POST /identity/check-username`
- `GET /auth/username-availability` (optionally uses the current bearer identity)
- `GET /leaderboard`
- `GET /ai/library`
- `GET /ai/source-score`
- `POST /moderation/check` (public safety check; bearer identity is optional)
- `GET /api/claims/{claim_id}/seo`
- `GET /api/topics/search`
- `GET /api/topics/{cluster_id}/claims`

### Authenticated user/profile endpoints

- `POST /mentions/tags`
- `POST /profile/ensure`
- `PATCH /profile`
- `POST /verification/request`
- `GET /profile/reputation-events`
- `DELETE /account`
- `POST /api/users/{user_id}/block`
- `DELETE /api/users/{user_id}/block`
- `GET /api/users/me/blocks`
- `POST /api/users/me/accept-terms`

### Authenticated claim, vote, AI, and evidence endpoints

- `POST /api/claims`
- `POST /api/claims/{claim_id}/vote`
- `POST /api/claims/embed`
- `POST /api/claims/check-duplicate`
- `POST /api/content/check-safety`
- `POST /api/claims/safety-check`
- `POST /claims/{claim_id}/finalize`
- `POST /ai/precheck`
- `POST /ai/precheck/retry`
- `DELETE /api/claims/{claim_id}`
- `POST /api/evidence/citation`
- `POST /api/evidence/{evidence_id}/dispute`
- `GET /api/evidence/{evidence_id}/disputes`

### Appeals and product administration

- `POST /api/appeals`
- `GET /api/appeals/mine`
- `GET /admin/metrics`
- `GET /admin/reports`
- `POST /admin/reports/{report_id}/resolve`
- `POST /admin/content/hide`
- `POST /admin/content/restore`
- `POST /admin/claims/delete`
- `POST /admin/claims/lock-voting`
- `POST /admin/claims/feature`
- `POST /admin/users/suspend`
- `POST /admin/claims/{claim_id}/hide`
- `POST /admin/claims/{claim_id}/unhide`
- `POST /admin/claims/{claim_id}/restore`
- `GET /admin/claims/hidden`
- `GET /admin/claims/reported`
- `GET /admin/appeals`
- `POST /admin/appeals/{appeal_id}/resolve`
- `GET /admin/manage/users`
- `GET /admin/manage/claims`
- `POST /admin/reputation/reset-monthly`
- `POST /admin/claims/override`
- `GET /admin/content-safety/openai-status`

### Identity administration

- `POST /admin/reserved/import`
- `POST /admin/import/reserved-identities`
- `GET /admin/verification-requests`
- `POST /admin/verification-requests/{request_id}/approve`
- `POST /admin/verification-requests/{request_id}/reject`
- `GET /admin/users`
- `GET /admin/me`
- `POST /admin/users/assign-role`
- `POST /admin/users/disable`
- `POST /admin/users/enable`

### Internal-only endpoints

- `POST /internal/safety-check`
- `POST /internal/safety-sweep`

The internal safety routes require a shared secret and must never be called or exposed by browser code. Admin routes must continue validating the bearer identity and role on the backend; hiding the UI is not authorization.

## 9. Environment variables for FactFight

Create a web-local `.env.local` later. Do not reuse or copy secrets from the root environment file into browser-exposed variables.

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Existing Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Existing Supabase publishable/anon key; security still depends on RLS |
| `NEXT_PUBLIC_RENDER_BACKEND_URL` | Public | `https://factlens-e8uf.onrender.com` |
| `NEXT_PUBLIC_SITE_URL` | Public | Local/preview URL initially; future canonical `https://factfight.com` only after DNS work is separately approved |

Potential server-only variables should be added only if a future Next.js route truly needs them. Neither `SUPABASE_SERVICE_ROLE_KEY` nor `OPENAI_API_KEY` belongs in `factfight-web`. The existing Render service must retain those secrets.

Supabase Auth redirect allowlists will eventually need local, preview, and production callback URLs. That configuration is a later release task and must not replace the old Verifact callback until FactFight is ready.

## 10. Security risks and required controls

| Finding | Risk | Required FactFight control |
| --- | --- | --- |
| The current mobile Supabase client has hardcoded public fallbacks | Wrong-project connections can be hidden by missing configuration | Web startup should validate required environment values and fail clearly; no hardcoded project fallback |
| Render currently allows CORS from `*` | Any origin can initiate browser calls to public/authenticated endpoints | Before production web launch, restrict allowed origins to approved local, preview, old-site, and FactFight domains as appropriate |
| Mobile services mix direct database writes with backend writes | Web could bypass authoritative validation or create contract drift | Use Render for claim creation, voting, finalization, AI, admin, profile protection, and reputation-sensitive work |
| Legacy client code calculates and can persist score/finalization fields | Browser-controlled verdicts or inconsistent results | Do not port those mutations; read server values only and keep the 40/60 calculation authoritative outside browser code |
| Broad row types include privileged fields | A form could accidentally serialize trusted fields | Use narrow mutation DTOs with explicit allowlists |
| Admin state is visible in `profiles` and client context | UI checks can be forged | Revalidate admin authorization on every backend call and protect `/moderation` server-side |
| Cookie-backed SSR can accidentally cache user data | One user's data could be served to another | Use per-request Supabase clients and disable shared caching for session-specific data |
| Realtime subscriptions expose live database events | Misconfigured RLS can leak rows | Subscribe with the user session and verify RLS for every subscribed table/filter |
| User-authored text, URLs, and mentions are rendered widely | XSS, unsafe navigation, and impersonation risk | Escape content, avoid raw HTML, allow only safe URL schemes, and preserve backend username reservation checks |
| Storage buckets are public-read | Sensitive or malicious uploads could be distributed | Enforce MIME/size/path rules, strip metadata where appropriate, use random names, and rely on owner-scoped storage policies |
| Cross-origin bearer calls will be added | Token leakage through logs or error monitoring | Never log access/refresh tokens; create bearer headers only inside trusted request helpers |
| Internal safety and privileged service credentials exist on Render | Catastrophic database/AI compromise if exposed | Never add internal secrets, service-role keys, or OpenAI keys to public env variables, bundles, responses, or source maps |
| Existing API contracts are hand-mapped in many services | Response changes can silently break UI | Centralize schemas/mappers and add contract tests against representative Render responses |

The active SQL file `supabase/sql/052_single_write_path_phase4_HOLD_DO_NOT_RUN.sql` is explicitly on hold. It must not be executed as part of the web migration without a separate database review and approval.

## 11. Recommended Next.js folder structure

```text
factfight-web/
  MIGRATION_AUDIT.md
  package.json
  next.config.ts
  postcss.config.mjs
  tsconfig.json
  src/
    middleware.ts
    app/
      layout.tsx
      page.tsx
      globals.css
      (auth)/
        login/page.tsx
        signup/page.tsx
      auth/
        callback/route.ts
      (main)/
        layout.tsx
        feed/page.tsx
        create/page.tsx
        search/page.tsx
        leaderboard/page.tsx
        claim/[id]/page.tsx
        profile/[username]/page.tsx
        moderation/page.tsx
      privacy/page.tsx
      terms/page.tsx
    components/
      claims/
      evidence/
      voting/
      profile/
      navigation/
      moderation/
      ui/
    lib/
      supabase/
        client.ts
        server.ts
        middleware.ts
      api/
        client.ts
        auth.ts
        claims.ts
        evidence.ts
        profiles.ts
        moderation.ts
      auth/
        guards.ts
      types/
        api.ts
        claim.ts
        evidence.ts
        profile.ts
        vote.ts
      utils/
      validation/
    styles/
      tokens.css
```

Server components should be the default for public/read pages. Client components should be limited to interactive voting, forms, dialogs, file selection, Realtime subscriptions, and responsive navigation state.

## 12. Design migration

Use `constants/theme.ts` as the current token source, not the older generic `constants/colors.ts` file.

FactFight light-theme tokens:

- Navy/primary: `#0D1B3E`
- True/success: `#1D9E75`
- Fake/danger: `#E24B4A`
- Unsure: `#EF9F27` for the new brand; this intentionally differs from the mobile warning token
- AI signal: `#534AB7`
- Background: `#FFFFFF`
- Card/secondary surface: `#F4F6F8`
- Main text: `#172033`
- Secondary text: `#475569`
- Muted text: `#6B7280`
- Border: `#D1D5DB` for subtle card borders; reserve stronger `#9CA3AF` for controls that need it
- Card radius: 12 px
- Spacing scale: 4, 8, 16, 24, 32, 40 px
- Type scale: 12/16, 16/24, 20/28, and 28/36; default weights 400 and 500
- Shadows: none by default; use borders and surface contrast instead of heavy elevation

Desktop can use a left navigation sidebar, centered feed, and right contextual panel. Mobile browsers should use a bottom navigation bar with safe-area padding. Navigation content and route permissions must remain the same across breakpoints.

Use sentence case, visible focus states, semantic headings, keyboard-accessible menus/dialogs, reduced-motion handling, and WCAG-appropriate contrast.

## 13. Route migration map

| FactFight route | Existing source | Access | Initial data/behavior |
| --- | --- | --- | --- |
| `/` | Backend/static landing plus mobile feed branding | Public | FactFight landing with clear login/signup/feed entry; do not replace old site yet |
| `/login` | `app/auth/index.tsx` | Public | Supabase password login and friendly errors |
| `/signup` | `app/auth/index.tsx` | Public | Backend username check, Supabase signup, terms acceptance, profile ensure |
| `/feed` | `app/(tabs)/index.tsx`, `ClaimCard` | Authenticated initially | Claims/profiles/vote summaries, save/report controls, Realtime refresh |
| `/claim/[id]` | `app/(tabs)/claim/[id].tsx` | Public read; auth for actions | Claim, evidence, votes, reports, media, AI risk signal, server verdict |
| `/create` | `app/(tabs)/create.tsx` | Authenticated | Local guidance, backend safety/duplicate checks, storage upload, `POST /api/claims` |
| `/search` | Current mobile screen is only a placeholder; topic search exists in feed | Public | Implement claims/topics/profiles search from approved read endpoints; do not claim mobile parity exists |
| `/profile/[username]` | `app/profile/[slug].tsx`, `app/user/[id].tsx` | Public read | Backend-first public profile plus author claims; canonicalize username/slug behavior |
| `/leaderboard` | `app/(tabs)/leaderboard.tsx` | Public | Render `/leaderboard`; display server-computed points/trust only |
| `/moderation` | `app/admin/moderation.tsx` | Admin only | Metrics, reports, claims, users, and appeals through Render admin endpoints |
| `/privacy` | `app/legal/privacy.tsx`, `client/landing/privacy.html`, backend `/privacy` | Public | Choose one reviewed FactFight copy source during implementation; do not remove old page |
| `/terms` | `app/legal/terms.tsx`, `client/landing/terms.html`, backend `/terms` | Public | Choose one reviewed FactFight copy source during implementation; do not remove old page |

Supporting routes required for a complete auth flow, though not listed as primary product pages, include `/auth/callback`, a password-reset route, and an email-confirmation result route.

Deferred parity routes include trending, notifications, saved claims, my claims, settings, blocked users, topic clusters, organizations, community guidelines, AI disclaimer, and copyright.

## 14. Recommended migration order

1. Freeze contracts and boundaries. Record the read models and narrow mutation DTOs; confirm the Render claim/vote/admin endpoints are authoritative. Do not run SQL 052.
2. Scaffold `factfight-web` as an isolated Next.js App Router project with its own package files, TypeScript configuration, Tailwind setup, linting, and tests.
3. Add CSS variables/Tailwind tokens and the responsive desktop/mobile application shell.
4. Implement Supabase browser/server/middleware clients, PKCE callback handling, login, signup, logout, protected-route guards, and profile ensure.
5. Build a typed Render API adapter with bearer propagation, timeouts, safe errors, and contract tests.
6. Port read-only claim/profile mapping and build `/feed`, `ClaimCard`, and `/claim/[id]` without mutation controls first.
7. Add authenticated create and vote flows through `POST /api/claims` and `POST /api/claims/{id}/vote`; verify the browser never submits privileged score/reputation fields.
8. Add evidence, reports, saved claims, blocking, mentions, image upload, and carefully scoped Realtime subscriptions.
9. Implement search, public profiles, and leaderboard; keep all trust/reputation values read-only.
10. Implement `/moderation` last, with server-side role protection and backend-only actions.
11. Add reviewed privacy/terms pages, accessibility testing, responsive testing, auth/session tests, RLS tests, and API contract tests.
12. Only after a separately approved staging review: configure preview auth redirects/CORS. DNS, production deployment, and retirement of the old endpoint remain separate release decisions.

## 15. Files and systems that must not be changed

For the migration phase, changes should remain inside `factfight-web/` unless a later task explicitly identifies and approves a backend contract gap.

Do not change:

- Existing Expo routes: `app/`
- Existing mobile components: `components/`
- Existing mobile contexts/hooks: `context/`, `hooks/`
- Existing mobile services/configuration: `services/`, `lib/supabase.ts`, `constants/`
- Expo/native configuration: `app.json`, `eas.json`, `android/`, `ios/`
- Existing mobile assets: `assets/`
- Root Expo dependency files: root `package.json` and root lockfile
- Render backend: `backend/` and its production environment variables
- Supabase schema and migrations: `supabase/`, including `051_soft_delete_claims.sql` and `052_single_write_path_phase4_HOLD_DO_NOT_RUN.sql`
- Legacy public site: `client/landing/`
- Existing Render URL and old Verifact domain/site
- Supabase project, Auth settings, RLS policies, Realtime configuration, and Storage buckets until separately approved
- DNS for `verifact.pennyfloat.com` or `factfight.com`

Do not delete, redirect, or replace `https://verifact.pennyfloat.com`. Do not deploy FactFight to production until the new application has passed a separate security, parity, responsive, and release review.

## 16. Definition of readiness for implementation

The audit supports beginning an isolated scaffold once approved. Before any production release, FactFight must demonstrate:

- No changes to or regressions in the Expo app.
- No browser bundle or public environment variable containing service-role, OpenAI, or internal safety secrets.
- Claims, votes, finalization, reputation, and admin decisions follow their authoritative server paths.
- The final score displayed by the web app is server-supplied and preserves the 40% AI / 60% weighted-community product rule.
- AI is consistently labeled as a signal rather than a verdict.
- Supabase RLS and Storage policies pass authenticated, anonymous, cross-user, suspended-user, and admin tests.
- Desktop and mobile-browser navigation expose equivalent allowed functionality.
- The old Verifact pages and endpoint remain available until an explicitly approved cutover.
