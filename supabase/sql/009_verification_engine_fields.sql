-- PHASE 3 STEP 17
-- Adds verification-engine fields needed by the local app-side scorer.

alter table public.claims
add column if not exists mode text default 'test',
add column if not exists current_phase integer default 0,
add column if not exists vote_accept_until timestamptz,
add column if not exists score_lock_at timestamptz,
add column if not exists published_at timestamptz,
add column if not exists phase4_locked boolean default false,
add column if not exists early_verdict_fired boolean default false,
add column if not exists suspicious_activity boolean default false,
add column if not exists weighted_community_score numeric default 0.5,
add column if not exists final_score numeric default 0.5,
add column if not exists min_votes_required integer default 5,
add column if not exists expected_participation integer default 10,
add column if not exists source_count integer default 0,
add column if not exists source_quality text default 'unknown',
add column if not exists red_flags text[] default '{}',
add column if not exists ai_summary text;

alter table public.votes
add column if not exists vote_value numeric,
add column if not exists trust_weight numeric default 1,
add column if not exists accepted boolean default true,
add column if not exists suspicious boolean default false,
add column if not exists rejected_reason text;

alter table public.profiles
add column if not exists votes_cast integer default 0,
add column if not exists accuracy_rate numeric,
add column if not exists trust_tier text default 'new',
add column if not exists trust_weight_override numeric;

update public.claims
set
  mode = coalesce(mode, 'test'),
  vote_accept_until = coalesce(vote_accept_until, created_at + interval '10 minutes'),
  score_lock_at = coalesce(score_lock_at, created_at + interval '15 minutes'),
  expires_at = coalesce(expires_at, created_at + interval '15 minutes'),
  min_votes_required = coalesce(min_votes_required, 5),
  expected_participation = coalesce(expected_participation, 10),
  weighted_community_score = coalesce(weighted_community_score, 0.5),
  final_score = coalesce(final_score, 0.5),
  current_phase = coalesce(current_phase, 0),
  phase4_locked = coalesce(phase4_locked, false),
  early_verdict_fired = coalesce(early_verdict_fired, false),
  suspicious_activity = coalesce(suspicious_activity, false),
  source_count = coalesce(source_count, 0),
  source_quality = coalesce(source_quality, 'unknown'),
  red_flags = coalesce(red_flags, '{}')
where mode is null
  or vote_accept_until is null
  or score_lock_at is null
  or min_votes_required is null
  or expected_participation is null;

update public.votes
set
  vote_value = case
    when vote_type = 'TRUE' then 1
    when vote_type = 'FAKE' then 0
    else null
  end,
  trust_weight = coalesce(trust_weight, 1),
  accepted = coalesce(accepted, true),
  suspicious = coalesce(suspicious, false)
where trust_weight is null
  or accepted is null
  or suspicious is null
  or vote_value is null;

create or replace function public.finalize_expired_claim(target_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  claim_status text;
  claim_score_lock_at timestamptz;
  true_votes integer;
  fake_votes integer;
  unsure_votes integer;
  computed_total_votes integer;
  minimum_votes integer;
  stored_weighted_score numeric;
  stored_final_score numeric;
  final_status text;
  final_reason text;
begin
  select
    status,
    coalesce(score_lock_at, expires_at),
    coalesce(votes_true, 0),
    coalesce(votes_fake, 0),
    coalesce(votes_unsure, 0),
    coalesce(min_votes_required, 5),
    coalesce(weighted_community_score, 0.5),
    coalesce(final_score, 0.5)
  into
    claim_status,
    claim_score_lock_at,
    true_votes,
    fake_votes,
    unsure_votes,
    minimum_votes,
    stored_weighted_score,
    stored_final_score
  from public.claims
  where id = target_claim_id;

  if not found then
    return;
  end if;

  if claim_status not in ('OPEN', 'VOTING_CLOSED') or claim_score_lock_at > now() then
    return;
  end if;

  computed_total_votes := true_votes + fake_votes + unsure_votes;

  if computed_total_votes < minimum_votes then
    final_status := 'NEEDS_MORE_EVIDENCE';
    final_reason := 'Minimum vote requirement was not met.';
  elsif stored_final_score >= 0.65 then
    final_status := 'COMMUNITY_TRUE';
    final_reason := 'AI confidence and community voting crossed the True threshold.';
  elsif stored_final_score <= 0.34 then
    final_status := 'COMMUNITY_FAKE';
    final_reason := 'AI confidence and community voting crossed the Fake threshold.';
  else
    final_status := 'NEEDS_MORE_EVIDENCE';
    final_reason := 'Combined AI and community score was not decisive.';
  end if;

  update public.claims
  set
    status = final_status,
    verdict_reason = final_reason,
    verdict_calculated_at = now(),
    published_at = now(),
    total_votes = computed_total_votes,
    phase4_locked = true,
    weighted_community_score = stored_weighted_score,
    final_score = stored_final_score,
    updated_at = now()
  where id = target_claim_id
    and status in ('OPEN', 'VOTING_CLOSED')
    and coalesce(score_lock_at, expires_at) <= now();
end;
$$;

grant execute on function public.finalize_expired_claim(uuid) to anon, authenticated;
