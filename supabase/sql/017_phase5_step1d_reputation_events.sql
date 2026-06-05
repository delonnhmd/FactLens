-- PHASE 5 STEP 1D
-- Reputation event log for transparent user activity history.

create table if not exists public.reputation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  claim_id uuid references public.claims(id) on delete set null,
  event_type text not null,
  points_delta integer default 0,
  trust_delta numeric default 0,
  badge_unlocked text,
  rank_before text,
  rank_after text,
  reason text,
  created_at timestamptz default now()
);

create index if not exists idx_reputation_events_user_created
on public.reputation_events (user_id, created_at desc);

create index if not exists idx_reputation_events_claim
on public.reputation_events (claim_id);

alter table public.reputation_events enable row level security;

drop policy if exists "Users can read their own reputation events"
on public.reputation_events;

create policy "Users can read their own reputation events"
on public.reputation_events
for select
using (auth.uid() = user_id);

drop policy if exists "Service role can manage reputation events"
on public.reputation_events;

create policy "Service role can manage reputation events"
on public.reputation_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create or replace function public.factlens_log_user_reputation_event(
  target_user_id uuid,
  target_claim_id uuid default null,
  target_event_type text default 'REPUTATION_UPDATE',
  target_points_delta integer default 0,
  target_trust_delta numeric default 0,
  target_badge_unlocked text default null,
  target_rank_before text default null,
  target_rank_after text default null,
  target_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_user_id is null then
    return;
  end if;

  insert into public.reputation_events(
    user_id,
    claim_id,
    event_type,
    points_delta,
    trust_delta,
    badge_unlocked,
    rank_before,
    rank_after,
    reason
  )
  values (
    target_user_id,
    target_claim_id,
    target_event_type,
    coalesce(target_points_delta, 0),
    coalesce(target_trust_delta, 0),
    target_badge_unlocked,
    target_rank_before,
    target_rank_after,
    target_reason
  );
end;
$$;

create or replace function public.factlens_log_badge_unlock_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  badge jsonb;
  badge_name text;
begin
  if coalesce(new.badge_list, '[]'::jsonb) = coalesce(old.badge_list, '[]'::jsonb) then
    return new;
  end if;

  for badge in
    select value
    from jsonb_array_elements(coalesce(new.badge_list, '[]'::jsonb)) as value
  loop
    if not exists (
      select 1
      from jsonb_array_elements(coalesce(old.badge_list, '[]'::jsonb)) old_badge
      where old_badge->>'id' = badge->>'id'
    ) then
      badge_name := coalesce(badge->>'name', 'New badge');
      perform public.factlens_log_user_reputation_event(
        new.id,
        null,
        'BADGE_UNLOCKED',
        0,
        0,
        badge_name,
        null,
        null,
        'You unlocked a new badge.'
      );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists factlens_badge_unlock_reputation_events on public.profiles;
create trigger factlens_badge_unlock_reputation_events
after update of badge_list on public.profiles
for each row
execute function public.factlens_log_badge_unlock_events();

create or replace function public.factlens_log_rank_upgrade_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_display_rank text;
  new_display_rank text;
begin
  old_display_rank := public.factlens_higher_rank(old.highest_rank_achieved, old.rank_title);
  new_display_rank := public.factlens_higher_rank(new.highest_rank_achieved, new.rank_title);

  if public.factlens_rank_order(new_display_rank) > public.factlens_rank_order(old_display_rank) then
    perform public.factlens_log_user_reputation_event(
      new.id,
      null,
      'RANK_UPGRADED',
      0,
      0,
      null,
      old_display_rank,
      new_display_rank,
      'Your reputation increased your rank.'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists factlens_rank_upgrade_reputation_events on public.profiles;
create trigger factlens_rank_upgrade_reputation_events
after update of rank_title, highest_rank_achieved on public.profiles
for each row
execute function public.factlens_log_rank_upgrade_events();

create or replace function public.factlens_record_reputation_event(
  target_claim_id uuid,
  target_user_id uuid,
  target_vote_id uuid,
  target_evidence_id uuid,
  event_type text,
  trust_delta numeric,
  reputation_delta integer,
  monthly_delta integer,
  correct_vote_delta integer,
  incorrect_vote_delta integer,
  helpful_evidence_delta integer,
  suspicious_flags_delta integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  public_event_type text := 'REPUTATION_UPDATE';
  public_reason text := 'Your reputation changed.';
begin
  insert into public.claim_reputation_events(
    claim_id,
    user_id,
    vote_id,
    evidence_id,
    event_type,
    trust_delta,
    reputation_delta,
    monthly_delta,
    correct_vote_delta,
    incorrect_vote_delta,
    helpful_evidence_delta,
    suspicious_flags_delta
  )
  values (
    target_claim_id,
    target_user_id,
    target_vote_id,
    target_evidence_id,
    event_type,
    trust_delta,
    reputation_delta,
    monthly_delta,
    correct_vote_delta,
    incorrect_vote_delta,
    helpful_evidence_delta,
    suspicious_flags_delta
  )
  on conflict do nothing;

  public_event_type := case
    when event_type = 'vote_matched_final_verdict' then 'CORRECT_VOTE'
    when event_type = 'vote_missed_final_verdict' then 'INCORRECT_VOTE'
    when event_type = 'evidence_supported_final_verdict' then 'HELPFUL_EVIDENCE'
    else upper(coalesce(event_type, 'REPUTATION_UPDATE'))
  end;

  public_reason := case
    when public_event_type = 'CORRECT_VOTE' then 'Your vote matched the finalized result.'
    when public_event_type = 'INCORRECT_VOTE' then 'Your vote did not match the finalized result.'
    when public_event_type = 'HELPFUL_EVIDENCE' then 'Your evidence helped support the final result.'
    else 'Your reputation changed.'
  end;

  perform public.factlens_log_user_reputation_event(
    target_user_id,
    target_claim_id,
    public_event_type,
    reputation_delta,
    trust_delta,
    null,
    null,
    null,
    public_reason
  );
end;
$$;

create or replace function public.factlens_handle_valid_vote_reputation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claim_author uuid;
  multiplier numeric := 1;
  points integer := 5;
begin
  select author_id into claim_author
  from public.claims
  where id = new.claim_id;

  if claim_author is null or claim_author = new.user_id or coalesce(new.accepted, true) = false then
    return new;
  end if;

  multiplier := coalesce(public.factlens_points_multiplier(new.user_id), 1);
  points := greatest(0, round(5 * multiplier));

  perform public.factlens_apply_profile_delta(
    new.user_id,
    0,
    points,
    points,
    0,
    0,
    1,
    0,
    0,
    0,
    'valid_vote'
  );

  perform public.factlens_log_user_reputation_event(
    new.user_id,
    new.claim_id,
    'VOTE_CAST',
    points,
    0,
    null,
    null,
    null,
    'You cast a valid vote.'
  );

  return new;
end;
$$;

create or replace function public.factlens_handle_evidence_reputation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claim_author uuid;
  earlier_evidence_count integer := 0;
  multiplier numeric := 1;
  points integer := 10;
  evidence_points integer := 10;
  source_bonus integer := 0;
begin
  select author_id into claim_author
  from public.claims
  where id = new.claim_id;

  if claim_author is null or claim_author = new.user_id then
    return new;
  end if;

  select count(*)
  into earlier_evidence_count
  from public.evidence
  where claim_id = new.claim_id
    and user_id = new.user_id
    and id <> new.id
    and created_at <= new.created_at;

  if earlier_evidence_count > 0 then
    return new;
  end if;

  multiplier := coalesce(public.factlens_points_multiplier(new.user_id), 1);
  evidence_points := greatest(0, round(10 * multiplier));
  source_bonus := case when coalesce(new.source_quality_score, 0) >= 85 then greatest(0, round(50 * multiplier)) else 0 end;
  points := evidence_points + source_bonus;

  perform public.factlens_apply_profile_delta(
    new.user_id,
    0,
    points,
    points,
    0,
    0,
    0,
    1,
    0,
    0,
    'evidence_added'
  );

  perform public.factlens_log_user_reputation_event(
    new.user_id,
    new.claim_id,
    'EVIDENCE_ADDED',
    evidence_points,
    0,
    null,
    null,
    null,
    'You added evidence to a claim.'
  );

  if source_bonus > 0 then
    perform public.factlens_log_user_reputation_event(
      new.user_id,
      new.claim_id,
      'HIGH_QUALITY_SOURCE',
      source_bonus,
      0,
      null,
      null,
      null,
      'Your evidence used a high-quality source.'
    );

    perform public.factlens_queue_reputation_notification(
      new.user_id,
      'high_quality_source',
      'Strong source contribution',
      'Your evidence used a high-quality source and boosted your contributor progress.',
      jsonb_build_object('evidence_id', new.id, 'claim_id', new.claim_id)
    );
  end if;

  return new;
end;
$$;

create or replace function public.reject_evidence_for_reputation(target_evidence_id uuid, confirmed_spam boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  evidence_row public.evidence%rowtype;
  reputation_penalty integer := 3;
  trust_penalty numeric := 0;
  suspicious_delta integer := 0;
begin
  select * into evidence_row
  from public.evidence
  where id = target_evidence_id;

  if not found then
    return;
  end if;

  if confirmed_spam then
    reputation_penalty := 10;
    trust_penalty := -5;
    suspicious_delta := 1;
  end if;

  perform public.factlens_apply_profile_delta(
    evidence_row.user_id,
    trust_penalty,
    -reputation_penalty,
    -reputation_penalty,
    0,
    0,
    0,
    0,
    0,
    suspicious_delta,
    case when confirmed_spam then 'evidence_confirmed_spam' else 'evidence_rejected' end
  );

  perform public.factlens_log_user_reputation_event(
    evidence_row.user_id,
    evidence_row.claim_id,
    case when confirmed_spam then 'SUSPICIOUS_PENALTY' else 'EVIDENCE_REJECTED' end,
    -reputation_penalty,
    trust_penalty,
    null,
    null,
    null,
    case
      when confirmed_spam then 'Suspicious activity was detected.'
      else 'Evidence was rejected as low quality.'
    end
  );
end;
$$;

notify pgrst, 'reload schema';
