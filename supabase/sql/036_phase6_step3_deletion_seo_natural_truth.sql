-- PHASE 6 STEP 3
-- Three additive features:
--   Feature 1: claim deletion — 3-hour window
--   Feature 2: account deletion — anonymize, not destroy
--   Feature 3: AI SEO tagging per claim + natural-truth classification
--
-- DEPLOY ORDER: apply this migration BEFORE deploying the backend that
-- references the new columns/table (claims.naturally_true_category,
-- claims.verdict_signal, claim_seo).

-- ============================================================
-- FEATURE 1: CLAIM DELETION — 3-HOUR WINDOW
-- ============================================================
-- INSPECTION RESULT: a finalization timestamp ALREADY EXISTS as
-- claims.verdict_calculated_at (added in 007_claim_verdict_fields.sql and set
-- by finalize_expired_claim / services/claimService.ts finalizeExpiredClaim).
-- Per spec ("if a finalization timestamp already exists under a different
-- name, use that"), NO new finalized_at column is added. Everywhere the spec
-- says finalized_at, this codebase uses verdict_calculated_at.
--
-- INSPECTION RESULT: claim deletion today is a HARD delete
-- (POST /admin/claims/delete and services/claimService.ts deleteClaim both
-- call .delete()); there is no deleted_at/is_deleted pattern on claims.
-- The new user-facing endpoint keeps the hard delete and the 3-hour window
-- is the guard. Child rows (votes, evidence, reports, mention_tags) already
-- cascade on claim delete, so hard delete remains safe.
--
-- ENFORCEMENT NOTE: the mobile client currently deletes claims DIRECTLY via
-- Supabase RLS (services/claimService.ts deleteClaim), not through the
-- backend. Tightening the author-delete policy below is therefore required —
-- without it the 3-hour rule would be unenforceable. Within the window the
-- client's direct delete keeps working exactly as before; outside the window
-- it is refused, which is the feature's stated rule ("after 3 hours OR after
-- finalization, no one can delete"). Admin deletion via the service role key
-- bypasses RLS and is unaffected.
drop policy if exists "Authors can delete their own claims" on public.claims;

create policy "Authors can delete their own claims"
on public.claims
for delete
to authenticated
using (
  auth.uid() = author_id
  and created_at > now() - interval '3 hours'
  and verdict_calculated_at is null
);

-- ============================================================
-- FEATURE 2: ACCOUNT DELETION — ANONYMIZE NOT DESTROY
-- ============================================================
-- INSPECTION RESULT: profiles.is_deleted and profiles.deleted_at ALREADY
-- EXIST (021_phase5_step4_account_safety.sql), and DELETE /account already
-- anonymizes the profile (display_name -> 'Deleted User', avatar_url/bio ->
-- null, etc). No new profile columns are needed.
--
-- INSPECTION RESULT: email is NOT stored on profiles — it lives in
-- auth.users, so email scrubbing happens in the backend via the GoTrue admin
-- API, not in this migration.
--
-- INSPECTION RESULT (display fallback): the claims query layer already maps
-- authors with is_deleted = true to the neutral name 'Deleted User'
-- (services/claimService.ts, mapProfile / COALESCE-equivalent in TS). That
-- existing behavior is the codebase's 'Anonymous' fallback and is left
-- untouched — nothing is stored in the name field beyond the anonymized
-- placeholder the existing endpoint already writes.
--
-- CRITICAL FK CHANGE (the one permitted ALTER to an existing constraint):
-- claims.author_id currently REFERENCES profiles(id) ON DELETE CASCADE
-- (002_claims.sql). Because profiles.id itself cascades from auth.users,
-- hard-deleting an auth user (e.g. from the Supabase dashboard) would today
-- CASCADE-DELETE every claim that user authored — violating the rule that
-- claims are permanent public record. We change it to ON DELETE RESTRICT.
--   * Why RESTRICT and not SET NULL: author_id is NOT NULL and altering an
--     existing column is forbidden, so SET NULL is not an option. RESTRICT
--     makes it impossible to hard-delete a profile that still has claims,
--     which is exactly the "no cascade delete on claims ever" rule.
--   * Normal account deletion is unaffected: it is an UPDATE (anonymize),
--     never a DELETE of the profile row.
-- EXACT CHANGE: constraint claims_author_id_fkey rebuilt with the same
-- columns/target, only the ON DELETE action changed CASCADE -> RESTRICT.
alter table public.claims
  drop constraint if exists claims_author_id_fkey;

alter table public.claims
  add constraint claims_author_id_fkey
  foreign key (author_id) references public.profiles(id) on delete restrict;

-- NOTE (comment only, no change): votes.user_id, evidence.user_id, and
-- reports.user_id also cascade from profiles. They are outside the one
-- permitted constraint ALTER (profiles<->claims), so they are documented
-- here and left as-is. Anonymization never deletes the profile row, so the
-- cascade never fires in the account-deletion flow.

-- ============================================================
-- FEATURE 3: AI SEO TAGGING — PER CLAIM, AUTOMATED
-- ============================================================
create table if not exists public.claim_seo (
  id uuid primary key default gen_random_uuid(),
  -- ON DELETE CASCADE (deviation from the spec's bare REFERENCES) is
  -- required: claim deletion in this codebase is a HARD delete, and a
  -- NO ACTION FK here would make every claim with SEO rows undeletable,
  -- breaking the existing admin delete flow and Feature 1. Matches the FK
  -- pattern of votes/evidence/reports.
  claim_id uuid not null references public.claims(id) on delete cascade,
  version text not null default 'creation',
  -- 'creation' | 'finalization'
  slug text not null,
  meta_title text not null,        -- max 60 chars (enforced in seo_service)
  meta_description text not null,  -- max 160 chars (enforced in seo_service)
  keywords text[] not null,        -- 5-10 keywords
  og_title text not null,
  og_description text not null,
  generated_at timestamptz default now(),
  unique (claim_id, version)
);

create index if not exists claim_seo_slug_idx on public.claim_seo (slug);
create index if not exists claim_seo_claim_id_idx on public.claim_seo (claim_id);

-- Match the existing table pattern: RLS on, public read (Google/frontend
-- must reach SEO metadata), writes only via the backend service role
-- (service role bypasses RLS, so no insert/update policy is needed).
alter table public.claim_seo enable row level security;

drop policy if exists "Anyone can read claim seo" on public.claim_seo;

create policy "Anyone can read claim seo"
on public.claim_seo
for select
using (true);

-- Natural-truth classification produced by the AI pre-check
-- (services/openai_factcheck.py). Stored alongside ai_status on claims,
-- which is where the rest of the AI analysis record lives. Both nullable —
-- additive, older rows simply have null.
alter table public.claims
  add column if not exists naturally_true_category text,
  add column if not exists verdict_signal text;

notify pgrst, 'reload schema';
