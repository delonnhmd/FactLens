-- ADMIN METRICS DASHBOARD SNAPSHOT
--
-- Required for GET /admin/metrics.
-- ADDITIVE ONLY: one SECURITY DEFINER function, no new tables.
-- Computes metrics from existing tables inside Postgres so the backend never
-- fetches rows just to count them.

create or replace function public.admin_metrics_snapshot(
  today_start timestamptz,
  week_start timestamptz,
  month_start timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today_new_users bigint := 0;
  today_claims_posted bigint := 0;
  today_votes_cast bigint := 0;
  today_reports_opened bigint := 0;

  week_new_users bigint := 0;
  week_claims_posted bigint := 0;
  week_votes_cast bigint := 0;
  week_reports_opened bigint := 0;
  week_active_voters bigint := 0;

  month_new_users bigint := 0;
  month_claims_posted bigint := 0;
  month_votes_cast bigint := 0;
  month_active_voters bigint := 0;

  total_users bigint := 0;
  total_claims bigint := 0;
  total_votes bigint := 0;
  hidden_claims bigint := 0;
  pending_reports bigint := 0;
  pending_appeals bigint := 0;
  total_blocks bigint := 0;
  wav_ratio numeric := 0;
begin
  select count(*) into today_new_users from public.profiles where created_at >= today_start;
  select count(*) into today_claims_posted from public.claims where created_at >= today_start;
  select count(*) into today_votes_cast from public.votes where created_at >= today_start;
  select count(*) into today_reports_opened from public.reports where created_at >= today_start;

  select count(*) into week_new_users from public.profiles where created_at >= week_start;
  select count(*) into week_claims_posted from public.claims where created_at >= week_start;
  select count(*) into week_votes_cast from public.votes where created_at >= week_start;
  select count(*) into week_reports_opened from public.reports where created_at >= week_start;
  select count(distinct user_id) into week_active_voters from public.votes where created_at >= week_start;

  select count(*) into month_new_users from public.profiles where created_at >= month_start;
  select count(*) into month_claims_posted from public.claims where created_at >= month_start;
  select count(*) into month_votes_cast from public.votes where created_at >= month_start;
  select count(distinct user_id) into month_active_voters from public.votes where created_at >= month_start;

  select count(*) into total_users from public.profiles;
  select count(*) into total_claims from public.claims;
  select count(*) into total_votes from public.votes;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'claims' and column_name = 'is_hidden'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'claims' and column_name = 'hidden'
  ) then
    execute 'select count(*) from public.claims where coalesce(is_hidden, false) = true or coalesce(hidden, false) = true'
      into hidden_claims;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'claims' and column_name = 'is_hidden'
  ) then
    execute 'select count(*) from public.claims where coalesce(is_hidden, false) = true'
      into hidden_claims;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'claims' and column_name = 'hidden'
  ) then
    execute 'select count(*) from public.claims where coalesce(hidden, false) = true'
      into hidden_claims;
  end if;
  select count(*) into pending_reports
  from public.reports
  where status in ('OPEN', 'REVIEWING');

  if to_regclass('public.moderation_appeals') is not null then
    execute 'select count(*) from public.moderation_appeals where status = $1'
      into pending_appeals
      using 'pending';
  end if;

  if to_regclass('public.user_blocks') is not null then
    execute 'select count(*) from public.user_blocks'
      into total_blocks;
  end if;

  wav_ratio := case
    when total_users > 0 then round((week_active_voters::numeric / total_users::numeric) * 100, 1)
    else 0
  end;

  return jsonb_build_object(
    'today', jsonb_build_object(
      'new_users', today_new_users,
      'claims_posted', today_claims_posted,
      'votes_cast', today_votes_cast,
      'reports_opened', today_reports_opened
    ),
    'week', jsonb_build_object(
      'new_users', week_new_users,
      'claims_posted', week_claims_posted,
      'votes_cast', week_votes_cast,
      'reports_opened', week_reports_opened,
      'active_voters', week_active_voters
    ),
    'month', jsonb_build_object(
      'new_users', month_new_users,
      'claims_posted', month_claims_posted,
      'votes_cast', month_votes_cast,
      'active_voters', month_active_voters
    ),
    'totals', jsonb_build_object(
      'users', total_users,
      'claims', total_claims,
      'votes', total_votes,
      'hidden_claims', hidden_claims,
      'pending_reports', pending_reports,
      'pending_appeals', pending_appeals,
      'blocks', total_blocks
    ),
    'health', jsonb_build_object(
      'weekly_active_voters', week_active_voters,
      'total_users', total_users,
      'wav_ratio', wav_ratio
    )
  );
end;
$$;

revoke all on function public.admin_metrics_snapshot(timestamptz, timestamptz, timestamptz) from public;
revoke all on function public.admin_metrics_snapshot(timestamptz, timestamptz, timestamptz) from anon;
revoke all on function public.admin_metrics_snapshot(timestamptz, timestamptz, timestamptz) from authenticated;
grant execute on function public.admin_metrics_snapshot(timestamptz, timestamptz, timestamptz) to service_role;

notify pgrst, 'reload schema';
