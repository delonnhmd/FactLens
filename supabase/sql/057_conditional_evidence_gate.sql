-- CONDITIONAL EVIDENCE GATE (Verdict Formula v1, one narrowed condition)
--
-- Applied to production 2026-07-24 via the Supabase MCP (recorded as a
-- migration). Kept here so the repo matches prod. Idempotent — safe to re-run.
--
-- THE ONE CHANGE: the "winning side must have at least one evidence item with
-- source_quality_score >= 40" requirement now applies ONLY when sided
-- evidence (SUPPORTS_TRUE / SUPPORTS_FAKE) has actually been submitted on the
-- claim. With zero sided evidence, the claim finalizes on the vote math alone
-- (E already defaults to 0.5 in that case, so C = 0.6*D + 0.2 — an effective
-- 75% decisive-share bar). When sided evidence EXISTS, the gate applies
-- exactly as before: weak/uncredible evidence still blocks a verdict no
-- matter the vote split (anti-brigading).
--
-- Non-sided evidence (ADDS_CONTEXT / UNCLEAR) is already excluded from the
-- evidence score and cannot satisfy the gate, so it does not count as
-- "evidence submitted" here either — otherwise a context-only claim could
-- never clear the gate and would re-create the exact stuck-forever bug this
-- fixes.
--
-- verdict_reason now states which path produced the verdict (Glass Verdict):
--   'Finalized on vote margin — no evidence submitted.'
--   'Finalized on vote margin + credible evidence.'
--   'Blocked by evidence gate — majority lacks credible support.'
--
-- Everything else (thresholds, weights, vote gates, VALUES_DISPUTE bypass,
-- min-votes gates, write path, finalize_due_claims, pg_cron schedule) is
-- unchanged from migration 055. Python mirror: backend/services/verdict_engine.py.
--
-- BACKFILL at the bottom: re-finalizes claims the old unconditional gate
-- already stamped NEEDS_MORE_EVIDENCE despite having zero sided evidence
-- ('Majority leaned TRUE/FAKE but no credible supporting evidence.'). Their
-- earlier finalization awarded no reputation (the non-verdict branch only
-- stamps reputation_processed_at; verified zero claim_reputation_events rows
-- in prod), so the stamp is cleared and the re-finalize awards credit exactly
-- once. Guarded per-claim: any claim that somehow has finalization reputation
-- events keeps its stamp and is skipped.

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
  -- CONDITIONAL GATE (057): how many sided evidence items exist at all.
  sided_evidence_count integer := 0;
  true_gate_ok boolean;
  fake_gate_ok boolean;
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
    -- Gate b0: under the claim's minimum total votes (default 15).
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
      coalesce(bool_or(evidence_type = 'SUPPORTS_FAKE' and coalesce(source_quality_score, 0) >= k_credible_score), false),
      count(*) filter (where evidence_type in ('SUPPORTS_TRUE', 'SUPPORTS_FAKE'))
    into ev_true, ev_fake, has_credible_true, has_credible_fake, sided_evidence_count
    from public.evidence
    where claim_id = target_claim_id;

    d := true_votes::numeric / decisive_votes;
    e := case when (ev_true + ev_fake) > 0 then ev_true / (ev_true + ev_fake) else 0.5 end;
    c := k_vote_weight * d + k_evidence_weight * e;

    -- CONDITIONAL GATE (057): with zero sided evidence there is nothing to
    -- gate on — vote math decides. With sided evidence present, the winning
    -- side still needs one credible (>= 40) item, exactly as before.
    true_gate_ok := (sided_evidence_count = 0) or has_credible_true;
    fake_gate_ok := (sided_evidence_count = 0) or has_credible_fake;

    if c >= k_true_threshold and d >= k_true_floor and true_gate_ok then
      final_status := 'FINALIZED_TRUE';
      final_reason := case when sided_evidence_count = 0
        then 'Finalized on vote margin — no evidence submitted.'
        else 'Finalized on vote margin + credible evidence.'
      end;
    elsif c <= k_fake_threshold and d <= k_fake_ceiling and fake_gate_ok then
      final_status := 'FINALIZED_FAKE';
      final_reason := case when sided_evidence_count = 0
        then 'Finalized on vote margin — no evidence submitted.'
        else 'Finalized on vote margin + credible evidence.'
      end;
    else
      final_status := 'NEEDS_MORE_EVIDENCE';

      if (c >= k_true_threshold and d >= k_true_floor)
         or (c <= k_fake_threshold and d <= k_fake_ceiling) then
        -- Only reachable when sided evidence exists and none of it on the
        -- majority's side is credible (the zero-evidence case finalizes above).
        final_reason := 'Blocked by evidence gate — majority lacks credible support.';
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

  -- Reputation processing (unchanged from 055): fail-soft, never blocks the
  -- verdict, and process_claim_reputation itself is a no-op once
  -- reputation_processed_at is stamped.
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

-- ---------------------------------------------------------------------------
-- BACKFILL: re-finalize claims the old unconditional gate blocked even though
-- zero sided evidence existed. Same single write path: flip back to
-- VOTING_CLOSED (already past deadline) and call finalize_expired_claim, so
-- the refined formula, Glass Verdict fields, notifications trigger, and
-- reputation processing all run through the one code path. Idempotent: the
-- criteria only match old-formula reasons, which this migration retires.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select c.id
    from public.claims c
    where c.status = 'NEEDS_MORE_EVIDENCE'
      and coalesce(c.is_deleted, false) = false
      and c.verdict_reason in (
        'Majority leaned TRUE but no credible supporting evidence.',
        'Majority leaned FAKE but no credible supporting evidence.'
      )
      and not exists (
        select 1
        from public.evidence e
        where e.claim_id = c.id
          and e.evidence_type in ('SUPPORTS_TRUE', 'SUPPORTS_FAKE')
      )
  loop
    -- The earlier finalization stamped reputation_processed_at without
    -- awarding anything (non-TRUE/FAKE branch). Clear the stamp so voters get
    -- their accuracy credit exactly once — but only when no finalization
    -- reputation events exist for the claim (double-award guard).
    update public.claims
    set status = 'VOTING_CLOSED',
        reputation_processed_at = null,
        updated_at = now()
    where id = r.id
      and not exists (
        select 1 from public.claim_reputation_events cre where cre.claim_id = r.id
      );

    if found then
      perform public.finalize_expired_claim(r.id);
    end if;
  end loop;
end $$;
