# Content Safety — Dual-Layer Gate (server enforcement + frontend pre-screen)

Two layers. The **server gate** is the enforcement (cannot be bypassed by any
client); the **frontend warning/pre-screen** is UX that can now fail harmlessly
because the gate backs it.

```
create.tsx (live banner + submit pre-screen)      ← UX, fail-open
        │  supabase-js insert (claimService.ts:1816)
        ▼
Postgres BEFORE INSERT trigger  = Layer 0          ← offline blocklist + regex, instant
        │  row lands PENDING (or BLOCKED)
        ▼
Supabase DB Webhook → POST /internal/safety-check  = Layers 1+2 (OpenAI mod + gpt-4.1-mini)
        │  writes APPROVED / BLOCKED (or leaves PENDING on OpenAI error)
        ▼
Render cron → POST /internal/safety-sweep          ← re-checks PENDING > 2 min (self-heal)

RLS policy "Only approved claims visible": public SELECT sees APPROVED only;
author sees own (any status); admin sees all.   ← THE enforcement
```

Enforcement lives in the RLS policy, not the app. A PENDING/BLOCKED claim is
invisible to everyone except its author and admins no matter what any client does.

---

## What shipped in code

| Piece | File |
|---|---|
| Migration: `safety_status` columns + backfill + index + RLS + `moderation_blocklist` (67) + Layer 0 trigger | `supabase/sql/048_content_safety_server_gate.sql` |
| Strict gate classifier (fail-CLOSED; `[moderation raw]` logging) | `backend/services/content_safety.py` → `classify_for_gate()` |
| Webhook + sweep endpoints | `backend/main.py` → `/internal/safety-check`, `/internal/safety-sweep` |
| Author badge (Under review / Removed) | `app/(tabs)/claim/[id].tsx`, `types/claim.ts`, `services/claimService.ts` |
| Live banner + submit pre-screen (already present) | `app/(tabs)/create.tsx`, `services/contentSafetyService.ts`, `utils/claimSafety.ts` |
| `/api/content/check-safety` (Part 2a, already present) | `backend/main.py` |

`classify_for_gate()` and `/api/content/check-safety` share the same layer
helpers (`_check_blocklist`, `_check_indirect_violence_patterns`,
`_moderation_verdict`, `_semantic_intent_check`). One implementation, two entry
points — the only difference is failure posture: the user path fails **open**
(never blocks a legit post), the gate fails **closed** (leaves PENDING, never
auto-approves on an OpenAI error).

---

## DEPLOY — do these in order

### 1. Run the migration (Supabase SQL editor) — REQUIRED, do this FIRST
Open Supabase → **SQL Editor** → paste the entire contents of
`supabase/sql/048_content_safety_server_gate.sql` → **Run**.

It backfills every existing claim to `APPROVED`, so nothing already in the feed
disappears. Only new inserts start as `PENDING`.

> ⚠️ If you deploy the backend/frontend *before* running this, `.select("*")`
> after insert still works (extra columns are ignored), but there is no gate and
> no `safety_status` column — run the SQL first.

### 2. Add the env var on Render, then deploy the backend
Render → your service → **Environment** → add:

```
SAFETY_WEBHOOK_SECRET = <a long random string — generate with: openssl rand -hex 32>
```

Confirm `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` are already
set (they are — used by the existing safety endpoints). Save → Render
auto-deploys `main`.

Smoke-test once live (replace SECRET):
```bash
SECRET=... ; BASE=https://factlens-e8uf.onrender.com
# 401 without the header:
curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE/internal/safety-sweep
# 200 with it:
curl -s -X POST $BASE/internal/safety-sweep -H "X-Safety-Secret: $SECRET"
```

### 3. Create the Supabase Database Webhook
Supabase → **Database → Webhooks** → **Create a new hook**:
- **Name:** `claims_safety_check`
- **Table:** `public.claims`
- **Events:** `Insert` only
- **Type:** `HTTP Request`
- **Method:** `POST`
- **URL:** `https://factlens-e8uf.onrender.com/internal/safety-check`
- **HTTP Headers:** add
  - `X-Safety-Secret` = the same value as `SAFETY_WEBHOOK_SECRET`
  - `Content-Type` = `application/json`
- **Timeout:** 5000 ms (default is fine)
- Save.

Supabase posts `{ "type":"INSERT", "table":"claims", "record":{…} }`; the
endpoint reads `record`.

### 4. Create the Render cron (retry sweep — self-heals missed webhooks)
Render → **New → Cron Job**:
- **Schedule:** `*/2 * * * *` (every 2 minutes)
- **Command:**
  ```bash
  curl -fsS -X POST https://factlens-e8uf.onrender.com/internal/safety-sweep \
    -H "X-Safety-Secret: $SAFETY_WEBHOOK_SECRET"
  ```
- Add `SAFETY_WEBHOOK_SECRET` to the cron job's environment too.

(Alternative if you don't want a second Render service: a free
https://cron-job.org job POSTing the same URL with the header works identically.)

### 5. Ship the frontend
```bash
eas update --channel preview
```
Then **force-quit and reopen** the app so it pulls the new JS bundle before testing.

---

## PART 3 — proof (run this yourself; paste the evidence back)

I cannot produce on-device output or live Render logs — run the steps below and
paste each cell. The two ship/no-ship lines are **"the president needs to be
killed" must block** and **"the senator voted against the bill" must post**.

For each phrase, on the device: (i) did the red banner show while typing,
(ii) did submit block or post, then (iii) the Render `[moderation raw]` log line,
(iv) the final `safety_status` from SQL.

### SQL verification queries (Supabase SQL editor)
```sql
-- Final state of everything you just tested, newest first:
select left(title, 48) as title, safety_status, safety_category, safety_checked_at
from public.claims
order by created_at desc
limit 20;

-- Prove the trigger table + policy exist:
select count(*) as blocklist_phrases from public.moderation_blocklist;      -- expect 67
select polname from pg_policy
  where polrelid = 'public.claims'::regclass and polname = 'Only approved claims visible';

-- Prove a second (non-author) account cannot see non-approved rows: run as that
-- user in the app feed, OR check the count of publicly-visible rows equals
-- APPROVED-only:
select safety_status, count(*) from public.claims group by 1;
```

### Reading the Render logs
Render → service → **Logs**, filter for `[moderation raw]` and `[safety-gate]`.
Each webhook/sweep run prints, e.g.:
```
[moderation raw] <claim_id> True {"violence": true, ...}
[safety-gate] <claim_id> -> BLOCKED layer=moderation
```

### Expected results table (fill the last two columns from your run)

| Title | Layer that catches it | Red banner? | Submit | `safety_status` |
|---|---|---|---|---|
| `I will kill` | 0 (trigger regex `will\s+kill`) | yes | blocked | BLOCKED |
| `we will kill everyone` | 0 (regex) | yes | blocked | BLOCKED |
| `the president needs to be killed` | 0 (regex `needs to be kill…`) | yes | blocked | BLOCKED |
| `someone should be killed` | 0 (regex `should…kill`) | yes | blocked | BLOCKED |
| `kill them all` | 0 (regex `kill them`) | yes | blocked | BLOCKED |
| `The senator voted against the border bill` | — | no | **posts** | APPROVED |
| `I disagree with the president's economic policy` | — | no | **posts** | APPROVED |
| `Crime rates rose in 2025 according to FBI data` | — | no | **posts** | APPROVED |

The MUST-BLOCK rows are caught at **Layer 0** — they insert as `BLOCKED` with no
network, so they are never publicly visible even if the webhook never fires. The
MUST-POST rows land `PENDING`, then the webhook/sweep flips them `APPROVED` after
OpenAI clears them (author sees "Under review — visible to others shortly" in the
gap; a second account sees them only once `APPROVED`).

### Also verify
- **Second account** never sees `PENDING`/`BLOCKED` claims in feed or by direct URL (RLS).
- **Author** sees their own with the badge; a blocked one shows "Removed — community guidelines" + a `claim_blocked` notification.
- **Admin** (`profiles.is_admin = true`) sees all.
- **Sweep self-heal:** temporarily disable the webhook, post a clean claim (lands
  PENDING), wait 2 min, run the sweep curl (or let cron fire) → it flips to
  APPROVED. Re-enable the webhook.

---

## Offline verification already done (local, no device)
- `backend/tests/test_content_safety_patterns.py` + `test_moderation_endpoint.py`: **17 passed**.
- `classify_for_gate()` on the 5 MUST-BLOCK phrases → all `BLOCKED` at Layer 0 with no OpenAI.
- SQL Layer 0 logic simulated exactly (67-phrase table + both regexes): 5/5 block, 3/3 must-post pass to PENDING.
- `npx tsc --noEmit`: clean. `node scripts/test-claim-safety.mjs`: passed.

---

## Apple review reply (accurate once Part 3 passes)
> Content is automatically screened at submission and again server-side before
> becoming publicly visible; violating content is blocked and the author is
> notified. Users can additionally report content, reviewed by our moderation
> team within 24 hours.
