-- PHASE 3 STEP 10
alter table public.claims
add column if not exists verdict_reason text,
add column if not exists verdict_calculated_at timestamptz,
add column if not exists total_votes integer default 0;

update public.claims
set total_votes = coalesce(votes_true, 0) + coalesce(votes_fake, 0) + coalesce(votes_unsure, 0)
where total_votes is null;

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
  final_status text;
  final_reason text;
begin
  select
    status,
    expires_at,
    coalesce(votes_true, 0),
    coalesce(votes_fake, 0),
    coalesce(votes_unsure, 0)
  into
    claim_status,
    claim_expires_at,
    true_votes,
    fake_votes,
    unsure_votes
  from public.claims
  where id = target_claim_id;

  if not found then
    return;
  end if;

  if claim_status <> 'OPEN' or claim_expires_at > now() then
    return;
  end if;

  computed_total_votes := true_votes + fake_votes + unsure_votes;

  if computed_total_votes < 5 then
    final_status := 'NEEDS_MORE_EVIDENCE';
    final_reason := 'Not enough community votes.';
  elsif unsure_votes > true_votes and unsure_votes > fake_votes then
    final_status := 'NEEDS_MORE_EVIDENCE';
    final_reason := 'Most voters were unsure.';
  elsif true_votes > fake_votes and true_votes >= computed_total_votes * 0.6 then
    final_status := 'COMMUNITY_TRUE';
    final_reason := 'True received at least 60% of total votes.';
  elsif fake_votes > true_votes and fake_votes >= computed_total_votes * 0.6 then
    final_status := 'COMMUNITY_FAKE';
    final_reason := 'Fake received at least 60% of total votes.';
  else
    final_status := 'NEEDS_MORE_EVIDENCE';
    final_reason := 'Vote result was too close.';
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
