-- PHASE 3 STEP 20D
-- Lets authenticated clients recalculate claim vote totals without requiring
-- the voter to be the claim author.

create or replace function public.recalculate_claim_vote_scores(target_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  true_votes integer := 0;
  fake_votes integer := 0;
  unsure_votes integer := 0;
  computed_total_votes integer := 0;
  weighted_score numeric := 0.5;
  ai_score numeric := 0.5;
  computed_final_score numeric := 0.5;
begin
  update public.votes
  set
    vote_value = case
      when vote_type = 'TRUE' then 1.0
      when vote_type = 'FAKE' then 0.0
      else null
    end,
    trust_weight = coalesce(trust_weight, 1.0),
    accepted = coalesce(accepted, true),
    suspicious = coalesce(suspicious, false),
    updated_at = now()
  where claim_id = target_claim_id
    and coalesce(accepted, true) = true;

  select
    count(*) filter (where vote_type = 'TRUE')::integer,
    count(*) filter (where vote_type = 'FAKE')::integer,
    count(*) filter (where vote_type = 'UNSURE')::integer,
    count(*)::integer
  into true_votes, fake_votes, unsure_votes, computed_total_votes
  from public.votes
  where claim_id = target_claim_id
    and accepted = true;

  select coalesce(
    sum(
      case
        when vote_type = 'TRUE' then 1.0
        when vote_type = 'FAKE' then 0.0
        else null
      end * coalesce(trust_weight, 1.0)
    ) / nullif(sum(coalesce(trust_weight, 1.0)), 0),
    0.5
  )
  into weighted_score
  from public.votes
  where claim_id = target_claim_id
    and accepted = true
    and vote_type in ('TRUE', 'FAKE');

  select
    case
      when ai_confidence is null then 0.5
      when ai_confidence > 1 then least(1.0, greatest(0.0, ai_confidence::numeric / 100.0))
      else least(1.0, greatest(0.0, ai_confidence::numeric))
    end
  into ai_score
  from public.claims
  where id = target_claim_id;

  computed_final_score := (coalesce(ai_score, 0.5) * 0.40) + (coalesce(weighted_score, 0.5) * 0.60);

  update public.claims
  set
    votes_true = true_votes,
    votes_fake = fake_votes,
    votes_unsure = unsure_votes,
    total_votes = computed_total_votes,
    weighted_community_score = round(weighted_score, 3),
    final_score = round(computed_final_score, 3),
    updated_at = now()
  where id = target_claim_id;
end;
$$;

grant execute on function public.recalculate_claim_vote_scores(uuid) to authenticated;
