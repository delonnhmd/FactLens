# FactFight public web phase (a) report

Date: 2026-07-16

Status: implementation and local production validation complete. Vercel deployment and DNS changes were documented but not executed.

## Scope and repository decision

The repository already had an isolated Next.js application in `factfight-web/`. Creating a second `factlens-web/` directory would duplicate package management, environment configuration, and migration history, so this phase extends the existing sibling application.

For a solo developer, the recommended structure remains a sibling application rather than a monorepo:

```text
C:\FactLens\
  app\                 # Existing Expo application; untouched
  backend\             # Existing Render service; untouched
  supabase\            # Existing database migrations; untouched
  factfight-web\       # Isolated Next.js public web application
```

The Step 3 authentication routes predated this request. They were not expanded, exposed in the new public navigation, or included in the sitemap. `robots.txt` disallows them. No login, signup, voting, claim creation, comments, profiles, moderation, or admin feature was built in this phase.

## Technical decisions

### Data source

Public pages use a stateless server-only `supabase-js` client with the anonymous key and no cookies. This was chosen after inspecting both available sources:

- The FastAPI claim route returns complete HTML rather than a reusable JSON claim contract.
- The FastAPI SEO route is UUID-only and its privileged read guard does not cover every visibility field.
- FastAPI topic routes exist, but their service-role claim queries and aggregate refresh do not apply the public claim visibility filters.
- Anonymous Supabase reads enforce production RLS, support claim slug lookup through `claim_seo`, and let the web layer select only the public columns it renders.

The public client disables session persistence and refresh, contains no service-role key, and sends no browser-side database requests. Public fetches revalidate every 60 seconds. The homepage and sitemap use ISR; claim and topic routes are server-rendered with revalidated public data.

### Types

The existing web-owned `PublicClaim` and `PublicClaimAuthor` read models were extended from the mobile domain shape. Separate read-only types were added for evidence, SEO metadata, and topic clusters. Privileged mutation fields are not represented in any new form or request DTO.

Later, if both clients begin sharing several stable contracts, extract only domain enums and read DTOs into a small `packages/domain` package. Do not share React Native components, Supabase clients, or write-side service code.

## Public features delivered

- `/`
  - Production recent claims ordered by creation date.
  - Production trending claims ordered by public vote count.
  - Read-only claim cards.
  - Verified App Store CTA for Verifact: `https://apps.apple.com/us/app/verifact/id6778583539`.
  - No login or signup links in the public experience.
- `/claim/[id]`
  - Supports an existing claim UUID or a `claim_seo.slug` in the same route.
  - Title, description, author, date, category, claim type, media, source, source-quality badge, AI risk signal, community vote totals, server-published verdict/final score, and public evidence.
  - Prominent `Download the app to vote` CTA.
  - Hidden, deleted, blocked, pending, missing, or malformed identifiers resolve to a real HTTP 404.
- `/topic/[slug]`
  - Supports topic UUID or slug.
  - Shows the server-published cluster verdict and aggregate totals plus member claim cards.
  - Requires at least one member claim visible through anonymous RLS before rendering the topic.
  - Production currently has no topic cluster with an anonymous-visible member claim, so existing hidden-only topic slugs intentionally return 404.

## SEO delivered

- Per-claim `generateMetadata()` uses `claim_seo` when available and safe deterministic claim metadata otherwise.
- Per-topic `generateMetadata()` uses topic metadata when a public topic is renderable.
- Canonical URLs prefer the claim or topic slug while UUID routes continue to work.
- Open Graph and Twitter large-card metadata use an approved claim image when available and `/opengraph-image` otherwise.
- A generated 1200 x 630 FactFight Open Graph fallback image is included.
- Claim pages contain `ClaimReview` JSON-LD with `claimReviewed`, the server status mapped to `reviewRating`, FactFight as the review organization, the claim author, and canonical URL.
- User-controlled values are validated before rendering. The JSON-LD serialization replaces `<` with its Unicode escape before insertion into the script element.
- Dynamic `sitemap.xml` lists only claims visible to anonymous readers and prefers their SEO slugs.
- Topic sitemap entries require an anonymous-visible member claim.
- `robots.txt` allows the public home, claim, and topic routes and excludes the pre-existing auth/feed routes.
- Security response headers disable framing, MIME sniffing, camera, microphone, and geolocation, and apply a strict referrer policy.

## Anonymous RLS proof

The production REST API was queried with only the public anonymous key. Values were never printed. Results on 2026-07-16:

```text
recent_visible_count=2
visible=6e793cc9-b893-4efe-8af7-4a7a4b33b294|INSUFFICIENT_DATA|APPROVED|hidden=False|is_hidden=False|is_deleted=False
visible=ff0fced0-0978-4582-81b8-258aa63f45ba|INSUFFICIENT_DATA|APPROVED|hidden=False|is_hidden=False|is_deleted=False
anon_hidden_visible_count=0
anon_is_hidden_visible_count=0
anon_deleted_visible_count=0
anon_pending_visible_count=0
anon_blocked_visible_count=0
```

The `claims` table therefore passed the requested anonymous visibility test. The page queries retain explicit `hidden=false`, `is_hidden=false`, `is_deleted=false`, and `safety_status=APPROVED` filters in addition to RLS.

One related database gap remains: `claim_seo` has an unconditional public-read policy and currently returns metadata rows for claims that anonymous `claims` reads cannot see. The web app prevents disclosure by resolving the slug and then requiring the related claim to pass anonymous RLS before metadata or content is rendered. This policy should still be tightened as a separate database task.

## Real route and 404 proof

Local production server, built with `NEXT_PUBLIC_SITE_URL=https://factfight.com`:

```text
/                                      status=200
/claim/6e793cc9-b893-4efe-8af7-4a7a4b33b294
                                       status=200
/claim/are-avocados-good-for-you-health-2024
                                       status=200
/claim/test-c-tanning-pending           status=404
/claim/00000000-0000-0000-0000-000000000000
                                       status=404
/topic/health-lifestyle-claims-fact-check
                                       status=404
/robots.txt                             status=200
/sitemap.xml                            status=200
/opengraph-image                        status=200 image/png
```

`test-c-tanning-pending` has a public SEO row but its related claim is hidden or soft-deleted from public claim access. Both the existing Render public claim route and the new Next.js route returned 404 for it. This proves the web route does not trust the public SEO row as claim visibility.

The route-level loading boundaries were deliberately removed from claim and topic pages after testing showed that streamed not-found UI produced HTTP 200. The final non-streamed availability checks return the required HTTP 404.

## Real claim head output

Captured from `/claim/are-avocados-good-for-you-health-2024` after a production-config build:

```html
<title>Are Avocados Good for You? Health Benefits Explained | FactFight</title>
<meta name="description" content="Avocados contain healthy fats, vitamins, minerals, and fiber but are high in calories. Portion control is important for weight management."/>
<link rel="canonical" href="https://factfight.com/claim/are-avocados-good-for-you-health-2024"/>
<meta property="og:title" content="Are Avocados Good for You? Health Benefits and Considerations"/>
<meta property="og:description" content="Avocados are rich in healthy fats and nutrients but also high in calories. Learn about their health benefits and the importance of portion control."/>
<meta property="og:url" content="https://factfight.com/claim/are-avocados-good-for-you-health-2024"/>
<meta property="og:image" content="https://factfight.com/opengraph-image"/>
<meta property="og:type" content="article"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="Are Avocados Good for You? Health Benefits and Considerations"/>
<meta name="twitter:description" content="Avocados are rich in healthy fats and nutrients but also high in calories. Learn about their health benefits and the importance of portion control."/>
<meta name="twitter:image" content="https://factfight.com/opengraph-image"/>
```

Structured-data extraction:

```text
jsonld_type=ClaimReview
claimReviewed=Are avocados good for you?
rating=3
rating_name=Insufficient data
```

The existing public SEO endpoint was called once during inspection for the visible avocado claim. By its documented lazy behavior, that GET generated/stored the claim's finalization SEO row. No backend code, configuration, or SQL was changed.

## Lighthouse proof

Command:

```powershell
npx.cmd --yes lighthouse@12.8.2 http://127.0.0.1:3100/claim/are-avocados-good-for-you-health-2024 --only-categories=seo --chrome-flags="--headless --no-sandbox --disable-gpu" --output=json --output-path=.next/lighthouse-claim-seo-v12.json --quiet
```

Result:

```text
lighthouse_version=12.8.2
seo_score=100
structured-data=valid
```

## Validation results

```text
npm.cmd run lint       PASS
npm.cmd run typecheck  PASS
npm.cmd run build      PASS
git diff --check       PASS
```

The final build used `NEXT_PUBLIC_SITE_URL=https://factfight.com`. Next.js generated `/` and `/sitemap.xml` with a one-minute revalidation interval and compiled the claim and topic server routes successfully.

Runtime scans found no service-role key reference, OpenAI key reference, internal safety secret, Expo/React Native import, claim write, vote write, or Supabase initialization with a privileged key in the new public implementation. The only `signInWithPassword` match is in the pre-existing Step 3 auth action, which this phase did not modify.

`npm audit` still reports the two previously documented moderate entries for the PostCSS advisory nested under the current Next.js release. It reports zero high and zero critical findings. npm proposes an invalid breaking downgrade, so no forced audit fix was applied.

## Backend and database follow-up tasks

These are separate tasks. None was implemented in this phase.

1. Apply the full public claim visibility predicate to FastAPI public reads.
   - `/claim/{claim_id}` checks the moderation flags but not `safety_status=APPROVED`.
   - `/api/claims/{claim_id}/seo` checks only the legacy `hidden` flag and should also check `is_hidden`, `is_deleted`, and `safety_status`.
2. Fix public topic endpoints before the web app uses them.
   - `/api/topics/search` previews, individual search, `/api/topics/{cluster_id}/claims`, and `update_cluster_stats` use service-role reads without the full public visibility predicate.
   - Public topic totals and verdicts should be computed from the same approved, non-hidden, non-deleted member set returned to readers.
3. Tighten `claim_seo` and `claim_topics` anonymous RLS.
   - `claim_seo` should be readable only when the related claim is public.
   - A topic should be readable only when it has at least one public member claim, or it should be served through a guarded backend view/endpoint.
4. Optional backend slug contract.
   - The Next.js app already supports slug lookup safely through anonymous `claim_seo` plus a second RLS-guarded claim read, so no backend change is required for this release.
   - If other clients need one source of truth later, add a guarded public `GET /api/claims/by-slug/{slug}` or allow the existing public claim route to resolve UUID-or-slug with the complete visibility predicate.

## Vercel deployment steps

1. Import the existing Git repository into Vercel.
2. Set the project root directory to `factfight-web` and framework preset to Next.js.
3. Use `npm install` and `npm run build`.
4. Add these production environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL=<existing public Supabase URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<existing public anon key>
NEXT_PUBLIC_RENDER_BACKEND_URL=https://factlens-e8uf.onrender.com
NEXT_PUBLIC_SITE_URL=https://factfight.com
```

5. Deploy to a Vercel preview URL first. Verify `/`, the real UUID route, the real slug route, the hidden route 404, `/sitemap.xml`, `/robots.txt`, and `/opengraph-image`.
6. Add both `factfight.com` and `www.factfight.com` to the Vercel project. Set `factfight.com` as canonical and redirect `www` to the apex.
7. Run `vercel domains inspect factfight.com` and `vercel domains inspect www.factfight.com` before editing DNS. If Vercel gives project-specific record targets, those targets take precedence over the general-purpose values below.

## DNS and API cutover sequence

Observed before any change:

```text
factfight.com             A      216.24.57.1
www.factfight.com         CNAME  factlens-e8uf.onrender.com
api.factfight.com         does not exist
verifact.pennyfloat.com   CNAME  factlens-e8uf.onrender.com
```

Render is at the stated 2/2 included custom-domain capacity. Use this order so neither the app nor API breaks:

1. Keep the Next.js production environment pointed at `https://factlens-e8uf.onrender.com` during the domain cutover. The Render subdomain remains available.
2. Lower the `factfight.com` and `www` DNS TTL before the maintenance window if the provider permits it.
3. Deploy and fully verify the Vercel production URL.
4. Add `factfight.com` and `www.factfight.com` in Vercel.
5. Replace the current DNS records:

```text
DELETE  @     A      216.24.57.1
ADD     @     A      76.76.21.21

DELETE  www   CNAME  factlens-e8uf.onrender.com
ADD     www   CNAME  cname.vercel-dns-0.com
```

Remove conflicting apex or `www` AAAA records if any appear. Confirm the exact Vercel values with `vercel domains inspect` because Vercel can issue project-specific targets.

6. Wait until both Vercel domains have valid TLS and the real UUID/slug routes work on `https://factfight.com`.
7. Only after the apex is no longer serving from Render, remove `factfight.com`/its automatic `www` association from the Render service to free a custom-domain slot. Do not remove `verifact.pennyfloat.com`.
8. Add `api.factfight.com` to the same Render web service.
9. Add this DNS record and verify it in Render:

```text
ADD  api  CNAME  factlens-e8uf.onrender.com
```

10. Wait for Render TLS, then verify `https://api.factfight.com/health` and representative public/API routes.
11. Change Vercel's `NEXT_PUBLIC_RENDER_BACKEND_URL` to `https://api.factfight.com` and redeploy.
12. Keep `https://factlens-e8uf.onrender.com` and `https://verifact.pennyfloat.com` reachable until mobile and web clients have been separately verified against the new API hostname.

No Vercel deployment, Render custom-domain change, DNS update, backend deploy, mobile OTA, EAS build, or SQL execution occurred in this phase.

## Files created

- `PHASE_A_REPORT.md`
- `src/app/opengraph-image.tsx`
- `src/app/robots.ts`
- `src/app/sitemap.ts`
- `src/app/topic/[slug]/page.tsx`
- `src/components/evidence/evidence-list.tsx`
- `src/components/navigation/public-site-footer.tsx`
- `src/components/navigation/public-site-header.tsx`
- `src/components/topics/topic-verdict-badge.tsx`
- `src/components/ui/app-store-link.tsx`
- `src/lib/api/topics.ts`
- `src/lib/constants/public-site.ts`
- `src/lib/supabase/public.ts`
- `src/lib/types/evidence.ts`
- `src/lib/types/seo.ts`
- `src/lib/types/topic.ts`

## Files changed

- `next-env.d.ts`
- `next.config.ts`
- `src/app/claim/[id]/page.tsx`
- `src/app/layout.tsx`
- `src/app/not-found.tsx`
- `src/app/page.tsx`
- `src/lib/api/claim-mappers.ts`
- `src/lib/api/claims.ts`
- `src/lib/types/claim.ts`
- `src/proxy.ts`
- `src/styles/tokens.css`

Removed route-level streaming boundaries:

- `src/app/claim/[id]/loading.tsx`

No file outside `factfight-web/` was changed.

## Local test command

From PowerShell:

```powershell
$env:NEXT_PUBLIC_SITE_URL='http://localhost:3000'; npm.cmd --prefix C:\FactLens\factfight-web run dev
```

Then open `http://localhost:3000`.
