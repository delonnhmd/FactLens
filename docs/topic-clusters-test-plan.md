# Topic Clustering — Test Plan (Phase 6 Step 4)

## Setup

```bash
export BASE="https://<your-render-backend>"
export SUPA="https://islcxqkevxxopatqvlqz.supabase.co"
export ANON_KEY="<supabase anon key>"
export TOKEN="<user access token>"   # supabase password grant, see docs/phase6-step3-test-plan.md
export USER_ID="<auth user id>"
```

Apply `supabase/sql/037_topic_clusters.sql` in the Supabase SQL editor
**before** deploying the backend. Frontend deploys with
`eas update --channel preview` only (JS-only changes — do NOT run `eas build`).

Claims are created client-side; simulate the app's flow with:

```bash
create_and_embed () {  # usage: create_and_embed "title" "description"
  CLAIM_ID=$(curl -s -X POST "$SUPA/rest/v1/claims" \
    -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" -H "Prefer: return=representation" \
    -d "{\"author_id\":\"$USER_ID\",\"title\":\"$1\",\"description\":\"$2\",
         \"source_url\":\"https://apnews.com/example\",\"category\":\"Politics\",
         \"status\":\"ACTIVE\",\"expires_at\":\"2026-07-03T00:00:00Z\"}" \
    | python -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")
  # The app fires this right after creating a claim — it stores the embedding
  # AND runs topic clustering:
  curl -s -X POST "$BASE/api/claims/embed" -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" -d "{\"claim_id\":\"$CLAIM_ID\"}" > /dev/null
  echo "$CLAIM_ID"
}
```

---

## (a) Two claims about the same topic → same cluster, claim_count = 2

```bash
C1=$(create_and_embed "Egg prices doubled in 2026" "Grocery data shows egg prices rose sharply")
C2=$(create_and_embed "Egg prices have gone up 100 percent this year" "Eggs cost twice as much as last year")

curl -s "$SUPA/rest/v1/claims?id=in.($C1,$C2)&select=id,topic_cluster_id" -H "apikey: $ANON_KEY"
```

**Expect:** both rows share the same non-null `topic_cluster_id`. Then:

```bash
curl -s "$SUPA/rest/v1/claim_topics?select=id,topic_label,claim_count,cluster_verdict" -H "apikey: $ANON_KEY"
```

**Expect:** one cluster row with `claim_count = 2`, an AI topic label, and
`cluster_verdict = "INSUFFICIENT_DATA"` (fewer than 10 votes).

## (b) Search "egg prices" → topic card above individual claims

```bash
curl -s "$BASE/api/topics/search?q=egg%20prices"
```

**Expect:** `topics[0]` has `topic_label`, `slug`, `cluster_verdict`,
`claim_count: 2`, and `preview_claims` (≤3, with `author_display_name`,
`true_votes`, `fake_votes`). `individual_claims` contains only matching claims
with **no** cluster. In the app: type "egg prices" in the home search — a navy
"Topics" card renders above the claim list.

## (c) Tap topic cluster → both claims with their own authors and votes

In the app, tap the topic card → `app/topic/[cluster_id].tsx` opens with the
topic header (label, verdict chip, true/fake vote bar, claim count) and both
claims as standard ClaimCards. Backend equivalent:

```bash
curl -s "$BASE/api/topics/<topic_cluster_id>/claims?limit=20&offset=0"
```

**Expect:** `topic` = full claim_topics row (no embedding), `claims` = 2 full
claim rows each with an embedded `profiles` author object, `total: 2`.

## (d) Vote on a claim → cluster totals increment, verdict recomputes

Vote in the app (or insert into `votes` via REST as the user). Then re-fetch:

```bash
curl -s "$BASE/api/topics/<topic_cluster_id>/claims" | python -m json.tool | grep -E "total_vote_count|cluster_verdict"
```

**Expect:** `total_vote_count` reflects the new vote and `cluster_verdict`
recomputes (10+ votes with true ≥ fake×1.2 → `"TRUE"`, etc.). NOTE: votes are
recorded client-side (no backend vote endpoint exists), so cluster stats
refresh **lazily on read** — any hit to `/api/topics/search` or
`/api/topics/<id>/claims` recomputes them. Voting then immediately reading is
exactly that flow.

## (e) Post a claim on a brand-new topic → new cluster created

```bash
C3=$(create_and_embed "City council approved the new transit levy" "Vote passed 7-2 on the transit measure")
curl -s "$SUPA/rest/v1/claims?id=eq.$C3&select=topic_cluster_id" -H "apikey: $ANON_KEY"
```

**Expect:** `topic_cluster_id` is non-null and **different** from the egg-price
cluster; `claim_topics` now has a second row with `claim_count = 1` and its own
label/slug/SEO fields.

---

## Extra checks

- **Create-screen card:** type a title (≥15 chars) similar to an existing
  topic on the Create tab, pause — the navy topic card appears above the
  quality warnings ("💬 N people have posted about '…'"), with a working
  Dismiss button; submitting is never blocked.
- **Backfill:** `python scripts/backfill_topic_clusters.py` — prints
  `Processed n/total claims`, safe to re-run, skips claims that already have a
  cluster.
- **Regressions:** claims with `topic_cluster_id IS NULL` behave exactly as
  before everywhere (feed, search, detail); `/api/claims/check-duplicate`
  returns its previous fields plus the always-present `topic_cluster` key;
  `/api/claims/embed` still returns `{"ok": bool}` unchanged.
