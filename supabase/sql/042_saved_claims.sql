-- SAVE / UNSAVE CLAIMS
--
-- ⚠️ RUN THIS MANUALLY IN THE SUPABASE SQL EDITOR (required migration).
--    Run before deploying the frontend update that uses saved_claims
--    (and after 039/040/041 if those are still pending).
--
-- ADDITIVE ONLY: one new table + RLS policies. No existing table, column,
-- constraint, or policy is altered. Idempotent — safe to re-run.
--
-- Reads join claims through the claim_id FK with the normal client, so the
-- existing claims RLS (hidden claims 040, blocked authors 038) filters a
-- user's saved list automatically.

create table if not exists public.saved_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  claim_id uuid not null references public.claims(id),
  created_at timestamptz default now(),
  unique (user_id, claim_id)
);

create index if not exists idx_saved_claims_user
  on public.saved_claims(user_id);

alter table public.saved_claims enable row level security;

drop policy if exists "Users read own saves" on public.saved_claims;
create policy "Users read own saves"
  on public.saved_claims for select
  using (auth.uid() = user_id);

drop policy if exists "Users create own saves" on public.saved_claims;
create policy "Users create own saves"
  on public.saved_claims for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own saves" on public.saved_claims;
create policy "Users delete own saves"
  on public.saved_claims for delete
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
