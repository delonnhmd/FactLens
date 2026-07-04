-- APPLE GUIDELINE 1.2 FIX — User blocking + EULA acceptance
--
-- ⚠️ RUN THIS MANUALLY IN THE SUPABASE SQL EDITOR (required migration).
--
-- ADDITIVE ONLY. Adds one table, one nullable column on profiles, indexes,
-- RLS policies, and ONE new RESTRICTIVE select policy on claims (a new
-- policy object — no existing table, column, constraint, or policy is
-- altered or dropped). Idempotent — safe to re-run.

-- 1. Blocks table (exact spec).
create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id),
  blocked_id uuid not null references public.profiles(id),
  -- optional: the claim that triggered the block,
  -- for developer notification context
  source_claim_id uuid references public.claims(id),
  created_at timestamptz default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id != blocked_id)
);

create index if not exists idx_user_blocks_blocker
  on public.user_blocks(blocker_id);

alter table public.user_blocks enable row level security;

drop policy if exists "Users read own blocks"
  on public.user_blocks;
create policy "Users read own blocks"
  on public.user_blocks for select
  using (auth.uid() = blocker_id);

drop policy if exists "Users create own blocks"
  on public.user_blocks;
create policy "Users create own blocks"
  on public.user_blocks for insert
  with check (auth.uid() = blocker_id);

drop policy if exists "Users delete own blocks"
  on public.user_blocks;
create policy "Users delete own blocks"
  on public.user_blocks for delete
  using (auth.uid() = blocker_id);

-- 2. EULA acceptance tracking (nullable — existing rows unaffected).
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz null;

-- 3. SERVER-SIDE FEED FILTERING (Apple req. 3a, persistent across restarts).
--
--    Inspection note: this app has NO backend feed endpoint — the feed,
--    search, trending, and topic screens all query the claims table directly
--    through supabase-js (services/claimService.ts). The one server-side
--    point every one of those queries passes through is claims RLS, so the
--    "NOT IN subquery on the feed endpoint" from the spec lands here as a
--    RESTRICTIVE policy (ANDed with the existing permissive policies, which
--    stay untouched).
--
--    - Applies only to the `authenticated` role: unauthenticated/anon
--      requests behave exactly as before.
--    - Backend service-role queries bypass RLS: admin/moderation views and
--      public share pages are unaffected.
--    - auth.uid() is the requester, so each user only loses claims authored
--      by people THEY blocked; the blocked user still sees their own claims.
--    - The unique (blocker_id, blocked_id) constraint above doubles as the
--      index that makes this NOT EXISTS lookup cheap.
drop policy if exists "Hide claims from blocked authors"
  on public.claims;
create policy "Hide claims from blocked authors"
  on public.claims
  as restrictive
  for select
  to authenticated
  using (
    not exists (
      select 1
      from public.user_blocks ub
      where ub.blocker_id = auth.uid()
        and ub.blocked_id = claims.author_id
    )
  );

notify pgrst, 'reload schema';
