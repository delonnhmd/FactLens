-- IN-DATABASE FINALIZATION SCHEDULE (pg_cron)
--
-- ✅ ALREADY APPLIED to production via the Supabase MCP on 2026-07-23.
--    Kept in the repo so repo SQL matches the live schema. Idempotent.
--
-- Belt-and-suspenders alongside the GitHub Actions cron
-- (.github/workflows/finalize-verdicts.yml -> /internal/finalize-sweep):
-- pg_cron runs the sweep inside Postgres every 10 minutes, so verdicts
-- publish even if GitHub schedules pause (GitHub disables cron workflows
-- after 60 days of repo inactivity) or the Render service is asleep.
-- finalize_due_claims is idempotent, so overlapping runs are harmless.

create extension if not exists pg_cron;

-- Re-schedule idempotently: unschedule any previous job with this name.
do $$
begin
  perform cron.unschedule('finalize-due-claims');
exception when others then
  null; -- job did not exist yet
end;
$$;

select cron.schedule(
  'finalize-due-claims',
  '*/10 * * * *',
  $$select public.finalize_due_claims(200);$$
);
