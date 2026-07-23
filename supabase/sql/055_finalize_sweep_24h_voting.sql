-- SERVER-SIDE FINALIZATION SWEEP + 24H VOTING (no dead zone)
--
-- ⚠️ RUN THIS MANUALLY IN THE SUPABASE SQL EDITOR (required migration).
--    Run before (or together with) deploying the backend that serves
--    POST /internal/finalize-sweep. Idempotent — safe to re-run.
--
-- WHY: verdict finalization was client-triggered and silently broken — the
-- mobile app's direct claims UPDATE was filtered to 0 rows by RLS for
-- non-authors (no error raised), so its RPC fallback never fired. Only 2
-- claims ever finalized. Finalization is now exclusively server-side: a
-- scheduled sweep (GitHub Actions cron -> /internal/finalize-sweep) calls
-- finalize_due_claims() below.
--
-- TIMING MODEL CHANGE: voting now runs a full 24 hours and the claim
-- finalizes at that same 24-hour mark. The old model closed voting at hour
-- 20 and published at hour 24, leaving a 4-hour "Locked" dead zone. The
-- backfill at the bottom aligns in-flight claims to the new model.
--
-- 1. finalize_expired_claim: same Verdict Formula v1 body as migration 043,
--    plus the minimum-vote gate (total votes < min_votes_required, default
--    15 -> INSUFFICIENT_DATA) and reputation processing on finalization.
-- 2. finalize_due_claims(batch_limit): finds every due, non-terminal,
--    non-deleted claim and finalizes it. Service-role only.
-- 3. Backfill: vote_accept_until/vote_window_end = score_lock_at for
--    in-flight claims (removes the 20h/24h split).

create or replace function public.finalize_expired_claim(target_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- v1 constants — mirror backend/services/verdict_engine.py
  k_true_threshold constant numeric := 0.65;  -- COMBINED_TRUE_THRESHOLD
  k_fake_threshold constant numeric := 0.35;  -- COMBINED_FAKE_THRESHOLD
  k_vote_weight constant numeric := 0.6;      -- VOTE_WEIGHT
  k_evidence_weight constant numeric := 0.4;  -- EVIDENCE_WEIGHT
  k_true_floor constant numeric := 0.60;      -- TRUE_VOTE_RATIO_FLOOR
  k_fake_ceiling constant numeric := 0.40;    -- FAKE_VOTE_RATIO_CEILING
  k_min_decisive constant integer := 10;      -- MIN_DECISIVE_VOTES
  k_not_sure_gate constant numeric := 0.40;   -- NOT_SURE_GATE
  k_credible_score constant numeric := 40;    -- CREDIBLE_SOURCE_SCORE

  claim_status text;
  claim_score_lock_at timestamptz;
  natural_category text;
  claim_min_votes integer;
  true_votes integer;
  fake_votes integer;
  unsure_votes integer;
  decisive_votes integer;
  computed_total_votes integer;
  not_sure_pct numeric;
  ev_true numeric := 0;
  ev_fake numeric := 0;
  has_credible_true boolean := false;
  has_credible_fake boolean := false;
  d numeric;
  e numeric;
  c numeric;
  final_status text;
  final_reason text;
begin
  select
    status,
    coalesce(score_lock_at, expires_at),
    naturally_true_category,
    coalesce(min_votes_required, 15),
    coalesce(votes_true, 0),
    coalesce(votes_fake, 0),
    coalesce(votes_unsure, 0)
  into
    claim_status,
    claim_score_lock_at,
    natural_category,
    claim_min_votes,
    true_votes,
    fake_votes,
    unsure_votes
  from public.claims
  where id = target_claim_id;

  if not found then
    return;
  end if;

  if claim_status not in ('OPEN', 'ACTIVE', 'EARLY_VERDICT', 'LOCKED', 'VOTING_CLOSED')
     or claim_score_lock_at > now() then
    return;
  end if;

  decisive_votes := true_votes + fake_votes;
  computed_total_votes := decisive_votes + unsure_votes;
  not_sure_pct := case
    when computed_total_votes > 0 then unsure_votes::numeric / computed_total_votes
    else 0
  end;

  if upper(coalesce(natural_category, '')) = 'VALUES_DISPUTE' then
    -- Gate a: values questions bypass all math.
    final_status := 'NEEDS_MORE_EVIDENCE';
    final_reason := 'Values question — Verifact does not rule on values disputes.';
  elsif computed_total_votes < claim_min_votes then
    -- Gate b0 (NEW): under the claim's minimum total votes (default 15).
    final_status := 'INSUFFICIENT_DATA';
    final_reason := 'Minimum vote requirement was not met.';
  elsif decisive_votes < k_min_decisive then
    -- Gate b.
    final_status := 'INSUFFICIENT_DATA';
    final_reason := 'Fewer than 10 decisive votes were cast.';
  elsif not_sure_pct > k_not_sure_gate then
    -- Gate c.
    final_status := 'NEEDS_MORE_EVIDENCE';
    final_reason := 'High community uncertainty.';
  else
    -- Evidence score per side (helpfulness = 1.0 until evidence_votes exists).
    select
      coalesce(sum(case when evidence_type = 'SUPPORTS_TRUE' then coalesce(source_quality_score, 0) end), 0),
      coalesce(sum(case when evidence_type = 'SUPPORTS_FAKE' then coalesce(source_quality_score, 0) end), 0),
      coalesce(bool_or(evidence_type = 'SUPPORTS_TRUE' and coalesce(source_quality_score, 0) >= k_credible_score), false),
      coalesce(bool_or(evidence_type = 'SUPPORTS_FAKE' and coalesce(source_quality_score, 0) >= k_credible_score), false)
    into ev_true, ev_fake, has_credible_true, has_credible_fake
    from public.evidence
    where claim_id = target_claim_id;

    d := true_votes::numeric / decisive_votes;
    e := case when (ev_true + ev_fake) > 0 then ev_true / (ev_true + ev_fake) else 0.5 end;
    c := k_vote_weight * d + k_evidence_weight * e;

    if c >= k_true_threshold and d >= k_true_floor and has_credible_true then
      final_status := 'FINALIZED_TRUE';
      final_reason := 'Community majority and credible supporting evidence both point to true.';
    elsif c <= k_fake_threshold and d <= k_fake_ceiling and has_credible_fake then
      final_status := 'FINALIZED_FAKE';
      final_reason := 'Community majority and credible evidence both point to fake.';
    else
      final_status := 'NEEDS_MORE_EVIDENCE';

      if c >= k_true_threshold and d >= k_true_floor then
        final_reason := 'Majority leaned TRUE but no credible supporting evidence.';
      elsif c <= k_fake_threshold and d <= k_fake_ceiling then
        final_reason := 'Majority leaned FAKE but no credible supporting evidence.';
      elsif c >= k_true_threshold then
        final_reason := 'Evidence leaned TRUE but the vote margin was below the 60% threshold.';
      elsif c <= k_fake_threshold then
        final_reason := 'Evidence leaned FAKE but the vote share was above the 40% threshold.';
      else
        final_reason := 'Vote margin below 65% threshold — the combined vote and evidence score landed between the True and Fake thresholds.';
      end if;
    end if;
  end if;

  update public.claims
  set
    status = final_status,
    verdict_reason = final_reason,
    combined_score = c,
    decisive_ratio = d,
    evidence_ratio = e,
    verdict_calculated_at = now(),
    published_at = now(),
    total_votes = computed_total_votes,
    phase4_locked = true,
    updated_at = now()
  where id = target_claim_id
    and status in ('OPEN', 'ACTIVE', 'EARLY_VERDICT', 'LOCKED', 'VOTING_CLOSED')
    and coalesce(score_lock_at, expires_at) <= now();

  -- Reputation processing used to run client-side at finalize time; it now
  -- runs here so voter accuracy stats update no matter who (or what)
  -- finalizes. Fail-soft: a reputation error must never block the verdict.
  if found then
    begin
      perform public.process_claim_reputation(target_claim_id);
    exception when others then
      raise notice 'process_claim_reputation failed for %: %', target_claim_id, sqlerrm;
    end;
  end if;
end;
$$;

revoke execute on function public.finalize_expired_claim(uuid) from anon;
grant execute on function public.finalize_expired_claim(uuid) to authenticated;

-- The sweep: everything due and non-terminal, oldest deadline first.
create or replace function public.finalize_due_claims(batch_limit integer default 200)
returns table (claim_id uuid, new_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  due record;
begin
  for due in
    select id
    from public.claims
    where status in ('OPEN', 'ACTIVE', 'EARLY_VERDICT', 'LOCKED', 'VOTING_CLOSED')
      and coalesce(is_deleted, false) = false
      and coalesce(score_lock_at, expires_at) <= now()
    order by coalesce(score_lock_at, expires_at)
    limit greatest(1, least(coalesce(batch_limit, 200), 500))
  loop
    perform public.finalize_expired_claim(due.id);
    claim_id := due.id;
    select status into new_status from public.claims where id = due.id;
    return next;
  end loop;
end;
$$;

-- Server-only: the backend calls this with the service-role key. Clients
-- never trigger finalization anymore.
revoke execute on function public.finalize_due_claims(integer) from public;
revoke execute on function public.finalize_due_claims(integer) from anon;
revoke execute on function public.finalize_due_claims(integer) from authenticated;
grant execute on function public.finalize_due_claims(integer) to service_role;

-- BACKFILL (timing model): in-flight claims created under the 20h/24h split
-- get their vote close aligned to the 24h finalize mark — voting simply
-- stays open until the verdict publishes, no dead zone.
update public.claims
set
  vote_accept_until = score_lock_at,
  vote_window_end = score_lock_at,
  vote_window_minutes = 1440,
  updated_at = now()
where status in ('OPEN', 'ACTIVE', 'EARLY_VERDICT')
  and published_at is null
  and coalesce(is_deleted, false) = false
  and score_lock_at is not null
  and vote_accept_until is distinct from score_lock_at;
