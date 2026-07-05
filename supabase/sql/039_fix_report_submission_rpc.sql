-- FIX: REPORT SUBMISSION FAILS ("Could not submit report right now.")
--
-- ⚠️ RUN THIS MANUALLY IN THE SUPABASE SQL EDITOR (required migration).
--    Run it BEFORE deploying anything else — it is the Apple-blocker fix
--    and needs no app update to take effect.
--
-- DIAGNOSIS (verified against production via PostgREST on 2026-07-04):
--   - The client insert into public.reports is fine: every column the app
--     sends exists, the 024 insert policy and current_user_can_submit()
--     are present and working.
--   - services/reportService.ts calls
--     rpc('recalculate_claim_report_count', { target_claim_id }) right
--     after the insert. Production returns PGRST202 — the function from
--     005_reports.sql DOES NOT EXIST there (only
--     recalculate_claim_vote_scores does). The service maps that error to
--     "Could not submit report right now.", so the report row is saved but
--     the user is told it failed.
--
-- FIX: recreate the function exactly as defined in 005_reports.sql,
-- re-grant it, and backfill report_count/is_flagged for claims whose
-- counts drifted while the function was missing. Idempotent, additive.

create or replace function public.recalculate_claim_report_count(target_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_report_count integer;
begin
  select count(*)::integer
  into next_report_count
  from public.reports
  where claim_id = target_claim_id;

  update public.claims
  set
    report_count = next_report_count,
    is_flagged = next_report_count >= 3,
    updated_at = now()
  where id = target_claim_id;
end;
$$;

grant execute on function public.recalculate_claim_report_count(uuid) to authenticated;

-- Backfill counts that drifted while the RPC was missing (reports were
-- inserted but claims.report_count was never updated).
update public.claims c
set
  report_count = sub.report_count,
  is_flagged = sub.report_count >= 3
from (
  select claim_id, count(*)::integer as report_count
  from public.reports
  where claim_id is not null
  group by claim_id
) sub
where c.id = sub.claim_id
  and c.report_count is distinct from sub.report_count;

notify pgrst, 'reload schema';
