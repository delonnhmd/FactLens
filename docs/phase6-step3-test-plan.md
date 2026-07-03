# Phase 6 Step 3 — Test Plan (curl)

Three additive features: 3-hour claim deletion window, account anonymization,
AI SEO tagging + natural-truth classification.

## Setup

```bash
export BASE="https://<your-render-backend>"            # Verifact backend on Render
export SUPA="https://islcxqkevxxopatqvlqz.supabase.co" # Supabase project URL
export ANON_KEY="<supabase anon key>"
export TOKEN="<user access token>"    # supabase.auth.getSession() from the app, or the password grant below
```

Get a user token via the password grant:

```bash
curl -s -X POST "$SUPA/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"<password>"}'
# -> copy .access_token into $TOKEN, .user.id into $USER_ID
```

Claims are created client-side in this codebase, so tests create them the same
way — directly against Supabase REST with the user JWT (the RLS insert policy):

```bash
create_claim () {  # usage: create_claim "title" "description" [created_at]
  curl -s -X POST "$SUPA/rest/v1/claims" \
    -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" -H "Prefer: return=representation" \
    -d "{\"author_id\":\"$USER_ID\",\"title\":\"$1\",\"description\":\"$2\",
         \"source_url\":\"https://apnews.com/example\",\"category\":\"Politics\",
         \"status\":\"ACTIVE\",\"expires_at\":\"2026-07-03T00:00:00Z\"
         $( [ -n "$3" ] && echo ",\"created_at\":\"$3\"" )}"
}
```

> Migration `supabase/sql/036_phase6_step3_deletion_seo_natural_truth.sql`
> must be applied BEFORE deploying the backend (adds `claim_seo`,
> `claims.naturally_true_category`, `claims.verdict_signal`).

---

## (a) Delete claim within 3 hours → succeeds

```bash
CLAIM_ID=$(create_claim "Window test claim" "Created just now" | python -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")

curl -s -X DELETE "$BASE/api/claims/$CLAIM_ID" -H "Authorization: Bearer $TOKEN"
```

**Expect:** `200` with `{"ok": true, "message": "Claim removed."}`.
Verify the row is gone: `curl -s "$SUPA/rest/v1/claims?id=eq.$CLAIM_ID" -H "apikey: $ANON_KEY"` → `[]`.

## (b) Delete claim after 3 hours → 403

`created_at` has a `default now()`, so backdate the row with the service role
key (RLS/inserts can't set it in normal flows):

```bash
OLD_CLAIM_ID=$(create_claim "Old claim" "Backdated for the window test" | python -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")

curl -s -X PATCH "$SUPA/rest/v1/claims?id=eq.$OLD_CLAIM_ID" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"created_at":"2026-07-01T00:00:00Z"}'

curl -s -w "\n%{http_code}\n" -X DELETE "$BASE/api/claims/$OLD_CLAIM_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Expect:** `403` with detail `"Claim can only be removed within 3 hours of posting."`
Also verify the finalized branch: set `verdict_calculated_at` on a fresh claim
the same way → `403` `"Claim is finalized and permanent."`
Also verify RLS enforcement (client-direct path):
`curl -s -X DELETE "$SUPA/rest/v1/claims?id=eq.$OLD_CLAIM_ID" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN"`
→ deletes 0 rows (policy refuses outside the window).

## (c) Delete account → claims still exist, author anonymized

```bash
KEEP_CLAIM_ID=$(create_claim "Permanent record claim" "Should survive account deletion" | python -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")

curl -s -X DELETE "$BASE/account" -H "Authorization: Bearer $TOKEN"
# -> {"ok":true,"mode":"anonymized","message":"Account deleted. Your contributions remain as part of the public record."}

# Claim still exists, authorship FK intact:
curl -s "$SUPA/rest/v1/claims?id=eq.$KEEP_CLAIM_ID&select=id,author_id,title" -H "apikey: $ANON_KEY"

# Profile is anonymized (PII gone, row + scores kept):
curl -s "$SUPA/rest/v1/profiles?id=eq.$USER_ID&select=display_name,avatar_url,bio,is_deleted,deleted_at" \
  -H "apikey: $ANON_KEY"
```

**Expect:** claim row unchanged; profile shows `display_name = "Deleted User"`,
`avatar_url/bio = null`, `is_deleted = true`. The app's claim feed renders the
author with the anonymized placeholder (claimService.ts maps `is_deleted`
profiles to the neutral name). The old `$TOKEN` stops refreshing (sessions
revoked); the auth email is replaced with a `@deleted.invalid` placeholder.

## (d) Create claim → SEO generated, slug returned

```bash
SEO_CLAIM_ID=$(create_claim "Senator Smith voted against the 2025 farm bill" "Roll call vote 214, June 2025" | python -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")

# The app calls /ai/precheck right after creation — that is the SEO trigger:
curl -s -X POST "$BASE/ai/precheck" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d "{\"claim_id\":\"$SEO_CLAIM_ID\"}"

# Public SEO endpoint (no auth):
curl -s "$BASE/api/claims/$SEO_CLAIM_ID/seo"
```

**Expect:** `200` with `seo.version = "creation"`, a lowercase hyphenated
`slug` (≤80 chars, includes 2025), `meta_title` ≤60, `meta_description` ≤160,
5–10 `keywords`, `og_title`, `og_description`. Re-running after the claim
finalizes returns `seo.version = "finalization"` (generated lazily with the
verdict).

## (e) Submit "1+1=3" claim → flagged MATHEMATICAL

```bash
MATH_CLAIM_ID=$(create_claim "1+1=3" "Basic arithmetic claim" | python -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")

curl -s -X POST "$BASE/ai/precheck" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d "{\"claim_id\":\"$MATH_CLAIM_ID\"}"
```

**Expect:** response JSON contains `"naturally_true_category": "MATHEMATICAL"`
and a high-confidence red flag about the arithmetic error in `red_flags`.
The value is also persisted: `curl -s "$SUPA/rest/v1/claims?id=eq.$MATH_CLAIM_ID&select=naturally_true_category,verdict_signal" -H "apikey: $ANON_KEY"`.

## (f) Submit gender claim → VALUES_DISPUTE, DISPUTED

```bash
VALUES_CLAIM_ID=$(create_claim "There are only two genders" "Values-framework claim" | python -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")

curl -s -X POST "$BASE/ai/precheck" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d "{\"claim_id\":\"$VALUES_CLAIM_ID\"}"
```

**Expect:** `"naturally_true_category": "VALUES_DISPUTE"`,
`"verdict_signal": "DISPUTED"`, `"ai_status": "NOT_FACT_CHECKABLE"`, and an
`ai_summary` explaining this is a values question Verifact does not rule on
(enforced in `_normalize_analysis` even if the model forgets).

---

## Regression checks (nothing existing may break)

- `GET /health` → `{"ok": true, ...}` unchanged.
- `POST /ai/precheck` on a normal claim → same response shape as before plus
  the two new optional fields; a SEO failure never changes the response
  (kill `OPENAI_API_KEY` and confirm precheck falls back exactly as before).
- `POST /admin/claims/delete` (admin token) → still hard-deletes any claim of
  any age (service role bypasses the new RLS window).
- Client delete of a <3h own claim via the app → still works.
