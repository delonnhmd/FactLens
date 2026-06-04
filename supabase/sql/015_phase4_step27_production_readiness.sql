-- PHASE 4 STEP 27
-- Production readiness alignment for verification timing, indexes, and finalizer statuses.

alter table public.claims
add column if not exists vote_window_minutes integer default 1200,
add column if not exists vote_window_end timestamptz;

alter table public.claims
alter column mode set default 'production',
alter column status set default 'ACTIVE',
alter column current_phase set default 1,
alter column min_votes_required set default 15,
alter column expected_participation set default 30,
alter column vote_window_minutes set default 1200,
alter column phase4_locked set default false,
alter column early_verdict_fired set default false,
alter column suspicious_activity set default false;

update public.claims
set
  mode = coalesce(mode, 'production'),
  current_phase = coalesce(current_phase, 1),
  vote_window_minutes = coalesce(vote_window_minutes, 1200),
  vote_window_end = coalesce(vote_window_end, vote_accept_until, created_at + interval '20 hours'),
  vote_accept_until = coalesce(vote_accept_until, vote_window_end, created_at + interval '20 hours'),
  score_lock_at = coalesce(score_lock_at, expires_at, created_at + interval '24 hours'),
  expires_at = coalesce(expires_at, score_lock_at, created_at + interval '24 hours'),
  min_votes_required = coalesce(min_votes_required, 15),
  expected_participation = coalesce(expected_participation, 30),
  phase4_locked = coalesce(phase4_locked, false),
  early_verdict_fired = coalesce(early_verdict_fired, false),
  suspicious_activity = coalesce(suspicious_activity, false)
where vote_window_end is null
   or vote_accept_until is null
   or score_lock_at is null
   or min_votes_required is null
   or expected_participation is null;

create index if not exists claims_status_idx on public.claims (status);
create index if not exists claims_score_lock_at_idx on public.claims (score_lock_at);
create index if not exists claims_vote_window_end_idx on public.claims (vote_window_end);
create index if not exists votes_claim_id_idx on public.votes (claim_id);
create index if not exists votes_user_id_idx on public.votes (user_id);
create index if not exists evidence_claim_id_idx on public.evidence (claim_id);

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
    coalesce(min_votes_required, 15),
    coalesce(final_score, 0.5)
  into
    claim_status,
    claim_score_lock_at,
    true_votes,
    fake_votes,
    unsure_votes,
    minimum_votes,
    stored_final_score
  from public.claims
  where id = target_claim_id;

  if not found then
    return;
  end if;

  if claim_status not in ('OPEN', 'ACTIVE', 'EARLY_VERDICT', 'LOCKED', 'VOTING_CLOSED')
     or claim_score_lock_at > now() then
    return;
  end if;

  computed_total_votes := true_votes + fake_votes + unsure_votes;

  if computed_total_votes < minimum_votes then
    final_status := 'INSUFFICIENT_DATA';
    final_reason := 'Minimum vote requirement was not met.';
  elsif stored_final_score >= 0.65 then
    final_status := 'FINALIZED_TRUE';
    final_reason := 'AI confidence and community voting crossed the True threshold.';
  elsif stored_final_score <= 0.34 then
    final_status := 'FINALIZED_FAKE';
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
    updated_at = now()
  where id = target_claim_id
    and status in ('OPEN', 'ACTIVE', 'EARLY_VERDICT', 'LOCKED', 'VOTING_CLOSED')
    and coalesce(score_lock_at, expires_at) <= now();
end;
$$;

revoke execute on function public.finalize_expired_claim(uuid) from anon;
grant execute on function public.finalize_expired_claim(uuid) to authenticated;

notify pgrst, 'reload schema';
