-- PHASE 3 VERIFICATION ENGINE
-- Replaces the old vote-only finalizer with the aggregate AI/community score.
-- Current app default is test mode: 15-minute publish window, minimum 5 votes.
-- Full trust-weighted scoring is calculated in the app service until the
-- database stores per-user trust metadata.

create or replace function public.finalize_expired_claim(target_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  claim_status text;
  claim_expires_at timestamptz;
  true_votes integer;
  fake_votes integer;
  unsure_votes integer;
  computed_total_votes integer;
  scored_votes integer;
  ai_score numeric;
  community_score numeric;
  final_score numeric;
  final_status text;
  final_reason text;
begin
  select
    status,
    expires_at,
    coalesce(votes_true, 0),
    coalesce(votes_fake, 0),
    coalesce(votes_unsure, 0),
    case
      when ai_confidence is null then 0.5
      when ai_confidence > 1 then least(greatest(ai_confidence::numeric / 100, 0), 1)
      else least(greatest(ai_confidence::numeric, 0), 1)
    end
  into
    claim_status,
    claim_expires_at,
    true_votes,
    fake_votes,
    unsure_votes,
    ai_score
  from public.claims
  where id = target_claim_id;

  if not found then
    return;
  end if;

  if claim_status <> 'OPEN' or claim_expires_at > now() then
    return;
  end if;

  computed_total_votes := true_votes + fake_votes + unsure_votes;
  scored_votes := true_votes + fake_votes;
  community_score := case
    when scored_votes > 0 then true_votes::numeric / scored_votes
    else 0.5
  end;
  final_score := (ai_score * 0.40) + (community_score * 0.60);

  if computed_total_votes < 5 then
    final_status := 'NEEDS_MORE_EVIDENCE';
    final_reason := 'Not enough community votes.';
  elsif final_score >= 0.65 then
    final_status := 'COMMUNITY_TRUE';
    final_reason := 'AI confidence and community voting crossed the True threshold.';
  elsif final_score <= 0.34 then
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
    total_votes = computed_total_votes,
    updated_at = now()
  where id = target_claim_id
    and status = 'OPEN'
    and expires_at <= now();
end;
$$;

grant execute on function public.finalize_expired_claim(uuid) to anon, authenticated;
