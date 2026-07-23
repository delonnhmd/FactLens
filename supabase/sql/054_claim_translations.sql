-- CLAIM TRANSLATIONS (per-claim en/vi/zh/es translation cache)
--
-- ⚠️ RUN THIS MANUALLY IN THE SUPABASE SQL EDITOR (required migration).
--    Run before (or right after) deploying the backend that serves
--    POST /api/claims/{id}/translate. The endpoint tolerates this table
--    being missing — translations then work but are not cached, so every
--    request costs an OpenAI call. Run this to enable caching.
--
-- ADDITIVE ONLY: one new table + RLS policy. No existing table, column,
-- constraint, or policy is altered. Idempotent — safe to re-run.
--
-- Writes happen only from the backend through the service-role key (which
-- bypasses RLS), so no insert/update/delete policies are defined for
-- clients. Reads are public — translations are derived from public claim
-- content.

create table if not exists public.claim_translations (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id),
  language_code text not null check (language_code in ('en','vi','zh','es')),
  translated_title text not null,
  translated_description text not null,
  created_at timestamptz default now(),
  unique (claim_id, language_code)
);

create index if not exists idx_claim_translations_claim
  on public.claim_translations(claim_id);

alter table public.claim_translations enable row level security;

drop policy if exists "Anyone reads translations" on public.claim_translations;
create policy "Anyone reads translations"
  on public.claim_translations for select
  using (true);
