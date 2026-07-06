-- VERDICT FORMULA v1 — vote + evidence combined verdict
--
-- ⚠️ RUN THIS MANUALLY IN THE SUPABASE SQL EDITOR (required migration).
--    Run BEFORE deploying the backend that includes verdict_engine.py.
--
-- Inspection notes:
--   - Finalization in this app is client-triggered: claimService.ts calls
--     the finalize_expired_claim RPC (there is NO backend Python
--     finalization path — main.py documents this). Redefining this RPC is
--     therefore THE wire-in that applies the v1 formula to NEW finalizations
--     with zero frontend change. The RPC body has been replaced this way in
--     007 -> 008 -> 009 -> 015; this is 016th-in-line, not a restructure.
--   - This SQL is a MIRROR of backend/services/verdict_engine.py (the
--     canonical implementation, used by the new POST /claims/{id}/finalize
--     endpoint). Keep the constants in both places in sync.
--   - Already-finalized claims are untouched: the status + score_lock_at
--     guards only let non-terminal, expired claims through, and no stored
--     verdict is recomputed.
--   - Columns: verdict_reason and verdict_calculated_at already exist.
--     combined_score / decisive_ratio / evidence_ratio are new and nullable.
--   - Evidence side attribution already exists (evidence.evidence_type:
--     SUPPORTS_TRUE | SUPPORTS_FAKE | ADDS_CONTEXT | UNCLEAR) — no
--     supports_side column is needed; no-side items are excluded.
--   - No evidence_votes table exists yet, so helpfulness = 1.0 here
--     (matching the Python engine's fail-soft branch).
--   - The app's status vocabulary has no DISPUTED: it stores as
--     NEEDS_MORE_EVIDENCE with the human explanation in verdict_reason.
--   - Topic cluster stats are untouched (cluster verdict formula unchanged).

alter table public.claims
  add column if not exists combined_score numeric,
  add column if not exists decisive_ratio numeric,
  add column if not exists evidence_ratio numeric;

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
    coalesce(votes_true, 0),
    coalesce(votes_fake, 0),
    coalesce(votes_unsure, 0)
  into
    claim_status,
    claim_score_lock_at,
    natural_category,
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
end;
$$;

revoke execute on function public.finalize_expired_claim(uuid) from anon;
grant execute on function public.finalize_expired_claim(uuid) to authenticated;

notify pgrst, 'reload schema';
