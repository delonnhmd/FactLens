-- PHASE 6 STEP 2 — Offline reference citations (books, newspapers, journals, documents).
--
-- ADDITIVE ONLY. No existing column, constraint, or row is altered or dropped.
-- New columns are nullable (or defaulted so every existing row stays valid) and
-- there is one new table. Existing URL-based evidence behaves exactly as before.
--
-- Run as-is in the Supabase SQL editor. Idempotent (safe to re-run).

-- 1. New columns on the existing evidence table.
--    reference_type: what kind of source this evidence is. Defaults to 'url', so
--    every pre-existing row is a valid 'url' row with no backfill needed.
--    citation: structured citation payload for offline sources (NULL for urls).
--    citation_verified: existence-check result. NULL = not applicable (url) or not
--    yet checked; TRUE/FALSE = the verification outcome.
alter table public.evidence
add column if not exists reference_type text not null default 'url',
add column if not exists citation jsonb,
add column if not exists citation_verified boolean;

-- CHECK constraint on the allowed reference types. The 'url' default guarantees
-- every existing row already satisfies this, so the constraint validates cleanly.
-- Guarded so re-running the migration does not error on an already-added constraint.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'evidence_reference_type_check'
  ) then
    alter table public.evidence
    add constraint evidence_reference_type_check
    check (reference_type in ('url', 'book', 'newspaper', 'journal', 'document'));
  end if;
end
$$;

-- NOTE (pre-existing constraint we intentionally do NOT touch): evidence.url is
-- NOT NULL. Offline citations have no URL, so the backend stores url = '' (empty
-- string) for them rather than altering the column — see citation_service /
-- the offline evidence endpoint. Flagging here; not changing it.

-- 2. New table: citation disputes (one dispute per user per citation).
create table if not exists public.citation_disputes (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence(id) on delete cascade,
  disputer_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  created_at timestamptz default now(),
  unique (evidence_id, disputer_id)
);

create index if not exists citation_disputes_evidence_id_idx
on public.citation_disputes (evidence_id);
create index if not exists citation_disputes_disputer_id_idx
on public.citation_disputes (disputer_id);

-- RLS mirrors the evidence table's conventions: readable by all, a user may only
-- insert their own dispute. The backend uses the service role (which bypasses
-- RLS), but we keep parity so the table is safe if ever queried with anon/auth keys.
alter table public.citation_disputes enable row level security;

drop policy if exists "Anyone can read citation disputes" on public.citation_disputes;
drop policy if exists "Users can insert their own citation disputes" on public.citation_disputes;

create policy "Anyone can read citation disputes"
on public.citation_disputes
for select
using (true);

create policy "Users can insert their own citation disputes"
on public.citation_disputes
for insert
to authenticated
with check (auth.uid() = disputer_id);

-- ---------------------------------------------------------------------------
-- Manual dispute resolution (admin/manual for now — no scoring hook yet).
-- Run one of these by hand to resolve a dispute:
--
--   update public.citation_disputes set status = 'confirmed' where id = ':dispute_id';
--   update public.citation_disputes set status = 'rejected'  where id = ':dispute_id';
--
-- FUTURE HOOK: when a dispute is set to 'confirmed', an accuracy-score PENALTY
-- should be applied to the citation's author (and a small BONUS to the disputer);
-- when 'rejected', the reverse/no-op. That reputation hook is intentionally NOT
-- built yet — it will plug in here (e.g. a trigger on status change, or a call
-- from an admin endpoint) alongside the existing reputation RPCs.
-- ---------------------------------------------------------------------------
