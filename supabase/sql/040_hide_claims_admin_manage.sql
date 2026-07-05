-- HIDE/UNHIDE CLAIMS (reversible moderation) + ADMIN MANAGEMENT SEARCH
--
-- ⚠️ RUN THIS MANUALLY IN THE SUPABASE SQL EDITOR (required migration).
--    Run 039_fix_report_submission_rpc.sql first, then this one, BEFORE
--    deploying the backend/frontend that use the new endpoints.
--
-- ADDITIVE ONLY. Inspection notes:
--   - claims.hidden / hidden_reason / hidden_at / hidden_by already exist
--     (020_phase5_step3_moderation_queue) and back the legacy
--     /admin/content/hide flow, which renders a "Content removed" box in
--     the app but leaves the claim in feeds. is_hidden is the NEW flag the
--     RLS policy filters on; the add-if-not-exists lines for the shared
--     metadata columns are no-ops where 020 already ran. The new backend
--     endpoints set BOTH flags so the two mechanisms never disagree.
--   - The restrictive policy is a NEW policy object ANDed with the existing
--     permissive select policies (same pattern as 038's
--     "Hide claims from blocked authors"). Existing rows default to
--     is_hidden = false, so nothing changes until an admin hides a claim.

alter table public.claims
  add column if not exists is_hidden boolean not null default false,
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_by uuid references public.profiles(id),
  add column if not exists hidden_reason text;

create index if not exists idx_claims_is_hidden
  on public.claims(is_hidden);

-- Hide from non-admin readers via RLS (restrictive, additive):
drop policy if exists "Hide hidden claims from public"
  on public.claims;
create policy "Hide hidden claims from public"
  on public.claims
  as restrictive
  for select
  using (
    is_hidden = false
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
    or auth.uid() = author_id  -- authors see their own hidden claims
  );

-- ADMIN USER MANAGEMENT SEARCH (backend service-role only).
-- profiles has NO email column (verified in production) — emails live in
-- auth.users, which PostgREST does not expose. This SECURITY DEFINER
-- function joins them and aggregates blocked_by_count (user_blocks, 038)
-- and claim_count in one round trip. Execute is granted to service_role
-- ONLY: the anon/authenticated roles can never read emails through it.
create or replace function public.admin_manage_users_search(
  search_query text default '',
  filter_mode text default 'all'
)
returns table (
  id uuid,
  username text,
  display_name text,
  email text,
  is_suspended boolean,
  is_admin boolean,
  created_at timestamptz,
  blocked_by_count bigint,
  claim_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.display_name,
    u.email::text,
    coalesce(p.is_suspended, false),
    coalesce(p.is_admin, false),
    p.created_at,
    (select count(*) from public.user_blocks b where b.blocked_id = p.id),
    (select count(*) from public.claims c where c.author_id = p.id)
  from public.profiles p
  left join auth.users u on u.id = p.id
  where (
      coalesce(search_query, '') = ''
      or p.username ilike '%' || search_query || '%'
      or u.email ilike '%' || search_query || '%'
    )
    and (
      coalesce(filter_mode, 'all') = 'all'
      or (filter_mode = 'suspended' and coalesce(p.is_suspended, false) = true)
      or (filter_mode = 'blocked' and exists (
        select 1 from public.user_blocks b2 where b2.blocked_id = p.id
      ))
    )
  order by p.created_at desc
  limit 50;
$$;

revoke all on function public.admin_manage_users_search(text, text) from public;
revoke all on function public.admin_manage_users_search(text, text) from anon;
revoke all on function public.admin_manage_users_search(text, text) from authenticated;
grant execute on function public.admin_manage_users_search(text, text) to service_role;

notify pgrst, 'reload schema';
