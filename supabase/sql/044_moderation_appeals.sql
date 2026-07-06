-- APPEAL A MODERATION DECISION
--
-- ⚠️ RUN THIS MANUALLY IN THE SUPABASE SQL EDITOR (required migration).
--    Run BEFORE deploying the backend/frontend that use /api/appeals.
--
-- ADDITIVE ONLY: one new table + RLS. No existing table, column, policy,
-- or moderation action is altered. Idempotent — safe to re-run.
--
-- Writes go through the backend (service role bypasses RLS); the insert
-- policy additionally lets the app write directly if ever needed. Note the
-- insert policy intentionally has NO current_user_can_submit() check:
-- suspended users MUST be able to file appeals (that is the whole point).

create table if not exists public.moderation_appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  -- what is being appealed
  action_type text not null check (action_type in
    ('claim_hidden','claim_removed','account_suspended')),
  claim_id uuid references public.claims(id),  -- null for suspensions
  notification_id uuid,  -- link back if available
  appeal_text text not null,
  status text not null default 'pending'
    check (status in ('pending','granted','denied')),
  reviewed_by uuid references public.profiles(id),
  review_note text,
  created_at timestamptz default now(),
  reviewed_at timestamptz
);

create index if not exists idx_appeals_status
  on public.moderation_appeals(status);
create index if not exists idx_appeals_user
  on public.moderation_appeals(user_id);

alter table public.moderation_appeals enable row level security;

drop policy if exists "Users read own appeals"
  on public.moderation_appeals;
create policy "Users read own appeals"
  on public.moderation_appeals for select
  using (auth.uid() = user_id);

drop policy if exists "Users create own appeals"
  on public.moderation_appeals;
create policy "Users create own appeals"
  on public.moderation_appeals for insert
  with check (auth.uid() = user_id);

drop policy if exists "Admins read all appeals"
  on public.moderation_appeals;
create policy "Admins read all appeals"
  on public.moderation_appeals for select
  to authenticated
  using (exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true));

notify pgrst, 'reload schema';
