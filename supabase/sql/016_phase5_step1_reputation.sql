-- PHASE 5 STEP 1
-- Reputation, rank, badge, leaderboard, and server-side reward processing.

alter table public.profiles
add column if not exists trust_score numeric default 50,
add column if not exists trust_tier text default 'BASIC',
add column if not exists rank_title text default 'Claim Checker',
add column if not exists correct_votes integer default 0,
add column if not exists incorrect_votes integer default 0,
add column if not exists evidence_count integer default 0,
add column if not exists helpful_evidence_count integer default 0,
add column if not exists suspicious_flags integer default 0,
add column if not exists reputation_points integer default 0,
add column if not exists badge_list jsonb default '[]'::jsonb,
add column if not exists last_active_at timestamptz,
add column if not exists highest_rank_achieved text default 'New Scout',
add column if not exists monthly_reputation_points integer default 0,
add column if not exists monthly_reset_at timestamptz default now();

alter table public.claims
add column if not exists reputation_processed_at timestamptz;

create table if not exists public.claim_reputation_events (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  vote_id uuid references public.votes(id) on delete set null,
  evidence_id uuid references public.evidence(id) on delete set null,
  event_type text not null,
  trust_delta numeric default 0,
  reputation_delta integer default 0,
  monthly_delta integer default 0,
  correct_vote_delta integer default 0,
  incorrect_vote_delta integer default 0,
  helpful_evidence_delta integer default 0,
  suspicious_flags_delta integer default 0,
  created_at timestamptz default now(),
  reversed_at timestamptz,
  unique (claim_id, user_id, event_type, vote_id, evidence_id)
);

create table if not exists public.reputation_notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  title text not null,
  body text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  delivered_at timestamptz
);

alter table public.claim_reputation_events enable row level security;
alter table public.reputation_notification_events enable row level security;

drop policy if exists "Users can read own reputation events" on public.claim_reputation_events;
create policy "Users can read own reputation events"
on public.claim_reputation_events
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own reputation notifications" on public.reputation_notification_events;
create policy "Users can read own reputation notifications"
on public.reputation_notification_events
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.factlens_rank_title_for_score(score numeric)
returns text
language sql
immutable
as $$
  select case
    when coalesce(score, 50) >= 90 then 'Verifact Guardian'
    when coalesce(score, 50) >= 75 then 'Source Hunter'
    when coalesce(score, 50) >= 55 then 'Trusted Verifier'
    when coalesce(score, 50) >= 30 then 'Claim Checker'
    else 'New Scout'
  end;
$$;

create or replace function public.factlens_tier_for_score(score numeric)
returns text
language sql
immutable
as $$
  select case
    when coalesce(score, 50) >= 75 then 'HIGH_TRUST'
    when coalesce(score, 50) >= 55 then 'TRUSTED'
    when coalesce(score, 50) >= 30 then 'BASIC'
    else 'LOW_TRUST'
  end;
$$;

create or replace function public.factlens_vote_weight_for_tier(tier text)
returns numeric
language sql
immutable
as $$
  select case upper(coalesce(tier, 'BASIC'))
    when 'LOW_TRUST' then 0.75
    when 'BASIC' then 1.0
    when 'TRUSTED' then 1.2
    when 'HIGH_TRUST' then 1.4
    else 1.0
  end;
$$;

create or replace function public.factlens_rank_order(rank_name text)
returns integer
language sql
immutable
as $$
  select case rank_name
    when 'New Scout' then 1
    when 'Claim Checker' then 2
    when 'Trusted Verifier' then 3
    when 'Source Hunter' then 4
    when 'Verifact Guardian' then 5
    else 1
  end;
$$;

create or replace function public.factlens_higher_rank(first_rank text, second_rank text)
returns text
language sql
immutable
as $$
  select case
    when public.factlens_rank_order(coalesce(first_rank, 'New Scout')) >=
         public.factlens_rank_order(coalesce(second_rank, 'New Scout'))
      then coalesce(first_rank, 'New Scout')
    else coalesce(second_rank, 'New Scout')
  end;
$$;

create or replace function public.factlens_add_badge(
  current_badges jsonb,
  badge_id text,
  badge_name text
)
returns jsonb
language plpgsql
as $$
begin
  if exists (
    select 1
    from jsonb_array_elements(coalesce(current_badges, '[]'::jsonb)) badge
    where badge->>'id' = badge_id
  ) then
    return coalesce(current_badges, '[]'::jsonb);
  end if;

  return coalesce(current_badges, '[]'::jsonb) ||
    jsonb_build_array(jsonb_build_object(
      'id', badge_id,
      'name', badge_name,
      'earned_at', now()
    ));
end;
$$;

create or replace function public.factlens_queue_reputation_notification(
  target_user_id uuid,
  event_type text,
  title text,
  body text,
  metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.reputation_notification_events(user_id, event_type, title, body, metadata)
  values (target_user_id, event_type, title, body, coalesce(metadata, '{}'::jsonb));
end;
$$;

create or replace function public.factlens_refresh_profile_badges(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
  next_badges jsonb;
  old_badge_count integer := 0;
  new_badge_count integer := 0;
  finalized_votes integer := 0;
  accuracy numeric := 0;
  recent_vote_days integer := 0;
  recent_month_vote_days integer := 0;
begin
  select * into profile_row
  from public.profiles
  where id = target_user_id;

  if not found then
    return;
  end if;

  next_badges := coalesce(profile_row.badge_list, '[]'::jsonb);
  old_badge_count := jsonb_array_length(next_badges);
  finalized_votes := coalesce(profile_row.correct_votes, 0) + coalesce(profile_row.incorrect_votes, 0);

  if finalized_votes > 0 then
    accuracy := coalesce(profile_row.correct_votes, 0)::numeric / finalized_votes::numeric;
  end if;

  select count(*)
  into recent_vote_days
  from (
    select distinct created_at::date as vote_day
    from public.votes
    where user_id = target_user_id
      and created_at::date >= current_date - 6
  ) days;

  select count(*)
  into recent_month_vote_days
  from (
    select distinct created_at::date as vote_day
    from public.votes
    where user_id = target_user_id
      and created_at::date >= current_date - 29
  ) days;

  if coalesce(profile_row.votes_cast, 0) >= 1 then
    next_badges := public.factlens_add_badge(next_badges, 'first_vote', 'First Vote');
  end if;
  if coalesce(profile_row.evidence_count, 0) >= 5 then
    next_badges := public.factlens_add_badge(next_badges, 'source_hunter', 'Source Hunter');
  end if;
  if coalesce(profile_row.correct_votes, 0) >= 10 then
    next_badges := public.factlens_add_badge(next_badges, 'sharp_eye', 'Sharp Eye');
  end if;
  if coalesce(profile_row.correct_votes, 0) >= 25 then
    next_badges := public.factlens_add_badge(next_badges, 'reliable_verifier', 'Reliable Verifier');
  end if;
  if coalesce(profile_row.reputation_points, 0) >= 50 then
    next_badges := public.factlens_add_badge(next_badges, 'truth_builder', 'Truth Builder');
  end if;
  if coalesce(profile_row.trust_score, 50) >= 90 then
    next_badges := public.factlens_add_badge(next_badges, 'guardian', 'Guardian');
  end if;
  if recent_vote_days >= 7 then
    next_badges := public.factlens_add_badge(next_badges, 'week_warrior', 'Week Warrior');
  end if;
  if recent_month_vote_days >= 30 then
    next_badges := public.factlens_add_badge(next_badges, 'monthly_regular', 'Monthly Regular');
  end if;
  if coalesce(profile_row.votes_cast, 0) >= 50 then
    next_badges := public.factlens_add_badge(next_badges, 'active_voter', 'Active Voter');
  end if;
  if coalesce(profile_row.votes_cast, 0) >= 100 then
    next_badges := public.factlens_add_badge(next_badges, 'power_voter', 'Power Voter');
  end if;
  if coalesce(profile_row.votes_cast, 0) >= 500 then
    next_badges := public.factlens_add_badge(next_badges, 'veteran', 'Veteran');
  end if;
  if finalized_votes >= 20 and accuracy >= 0.80 then
    next_badges := public.factlens_add_badge(next_badges, 'sharp_mind', 'Sharp Mind');
  end if;
  if finalized_votes >= 30 and accuracy >= 0.90 then
    next_badges := public.factlens_add_badge(next_badges, 'precision_voter', 'Precision Voter');
  end if;

  if (
    select count(*)
    from public.votes v
    join public.claims c on c.id = v.claim_id
    where v.user_id = target_user_id
      and c.category ilike 'Politics'
      and (
        (v.vote_type = 'TRUE' and c.status in ('FINALIZED_TRUE', 'COMMUNITY_TRUE')) or
        (v.vote_type = 'FAKE' and c.status in ('FINALIZED_FAKE', 'COMMUNITY_FAKE'))
      )
  ) >= 20 then
    next_badges := public.factlens_add_badge(next_badges, 'politics_expert', 'Politics Expert');
  end if;

  if (
    select count(*)
    from public.votes v
    join public.claims c on c.id = v.claim_id
    where v.user_id = target_user_id
      and c.category ilike 'Crypto'
      and (
        (v.vote_type = 'TRUE' and c.status in ('FINALIZED_TRUE', 'COMMUNITY_TRUE')) or
        (v.vote_type = 'FAKE' and c.status in ('FINALIZED_FAKE', 'COMMUNITY_FAKE'))
      )
  ) >= 20 then
    next_badges := public.factlens_add_badge(next_badges, 'crypto_checker', 'Crypto Checker');
  end if;

  if (
    select count(*)
    from public.votes v
    join public.claims c on c.id = v.claim_id
    where v.user_id = target_user_id
      and c.category ilike 'Health'
      and (
        (v.vote_type = 'TRUE' and c.status in ('FINALIZED_TRUE', 'COMMUNITY_TRUE')) or
        (v.vote_type = 'FAKE' and c.status in ('FINALIZED_FAKE', 'COMMUNITY_FAKE'))
      )
  ) >= 20 then
    next_badges := public.factlens_add_badge(next_badges, 'health_watcher', 'Health Watcher');
  end if;

  if (
    select count(*)
    from public.votes v
    join public.claims c on c.id = v.claim_id
    where v.user_id = target_user_id
      and c.category ilike 'Business'
      and (
        (v.vote_type = 'TRUE' and c.status in ('FINALIZED_TRUE', 'COMMUNITY_TRUE')) or
        (v.vote_type = 'FAKE' and c.status in ('FINALIZED_FAKE', 'COMMUNITY_FAKE'))
      )
  ) >= 20 then
    next_badges := public.factlens_add_badge(next_badges, 'business_analyst', 'Business Analyst');
  end if;

  if exists (
    select 1
    from (
      select
        v.user_id,
        v.claim_id,
        row_number() over (partition by v.claim_id order by v.created_at asc) as vote_position
      from public.votes v
      join public.claims c on c.id = v.claim_id
      where c.total_votes >= 50
    ) ranked_votes
    where ranked_votes.user_id = target_user_id
      and ranked_votes.vote_position <= 10
  ) then
    next_badges := public.factlens_add_badge(next_badges, 'first_responder', 'First Responder');
  end if;

  new_badge_count := jsonb_array_length(next_badges);

  update public.profiles
  set
    badge_list = next_badges,
    updated_at = now()
  where id = target_user_id;

  if new_badge_count > old_badge_count then
    perform public.factlens_queue_reputation_notification(
      target_user_id,
      'badge_earned',
      'New Verifact badge earned',
      'You earned a new badge! Your contributions are making a difference.',
      jsonb_build_object('badge_count', new_badge_count)
    );
  end if;
end;
$$;

create or replace function public.factlens_apply_profile_delta(
  target_user_id uuid,
  trust_delta numeric default 0,
  reputation_delta integer default 0,
  monthly_delta integer default 0,
  correct_vote_delta integer default 0,
  incorrect_vote_delta integer default 0,
  votes_cast_delta integer default 0,
  evidence_count_delta integer default 0,
  helpful_evidence_delta integer default 0,
  suspicious_flags_delta integer default 0,
  notification_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_rank text;
  new_rank text;
  next_trust_score numeric;
  reset_month_start timestamptz;
  monthly_position integer;
begin
  reset_month_start := date_trunc('month', now());

  select public.factlens_higher_rank(highest_rank_achieved, rank_title)
  into old_rank
  from public.profiles
  where id = target_user_id;

  update public.profiles
  set
    monthly_reputation_points = case
      when monthly_reset_at is null or date_trunc('month', monthly_reset_at) < reset_month_start
        then 0
      else coalesce(monthly_reputation_points, 0)
    end,
    monthly_reset_at = case
      when monthly_reset_at is null or date_trunc('month', monthly_reset_at) < reset_month_start
        then now()
      else monthly_reset_at
    end
  where id = target_user_id;

  update public.profiles
  set
    trust_score = least(100, greatest(0, coalesce(trust_score, 50) + coalesce(trust_delta, 0))),
    reputation_points = greatest(0, coalesce(reputation_points, 0) + coalesce(reputation_delta, 0)),
    monthly_reputation_points = greatest(0, coalesce(monthly_reputation_points, 0) + coalesce(monthly_delta, 0)),
    correct_votes = greatest(0, coalesce(correct_votes, 0) + coalesce(correct_vote_delta, 0)),
    incorrect_votes = greatest(0, coalesce(incorrect_votes, 0) + coalesce(incorrect_vote_delta, 0)),
    votes_cast = greatest(0, coalesce(votes_cast, 0) + coalesce(votes_cast_delta, 0)),
    evidence_count = greatest(0, coalesce(evidence_count, 0) + coalesce(evidence_count_delta, 0)),
    helpful_evidence_count = greatest(0, coalesce(helpful_evidence_count, 0) + coalesce(helpful_evidence_delta, 0)),
    suspicious_flags = greatest(0, coalesce(suspicious_flags, 0) + coalesce(suspicious_flags_delta, 0)),
    last_active_at = now(),
    updated_at = now()
  where id = target_user_id
  returning trust_score into next_trust_score;

  if next_trust_score is null then
    return;
  end if;

  new_rank := public.factlens_rank_title_for_score(next_trust_score);

  update public.profiles
  set
    trust_tier = public.factlens_tier_for_score(trust_score),
    rank_title = new_rank,
    highest_rank_achieved = public.factlens_higher_rank(highest_rank_achieved, new_rank),
    updated_at = now()
  where id = target_user_id;

  if public.factlens_rank_order(new_rank) > public.factlens_rank_order(coalesce(old_rank, 'New Scout')) then
    perform public.factlens_queue_reputation_notification(
      target_user_id,
      'rank_reached',
      'You reached ' || new_rank,
      'Your Verifact contributor rank increased.',
      jsonb_build_object('rank_title', new_rank, 'reason', notification_reason)
    );
  end if;

  perform public.factlens_refresh_profile_badges(target_user_id);

  select ranked.position
  into monthly_position
  from (
    select
      id,
      row_number() over (order by coalesce(monthly_reputation_points, 0) desc, coalesce(trust_score, 50) desc) as position
    from public.profiles
  ) ranked
  where ranked.id = target_user_id;

  if monthly_position is not null
    and monthly_position <= 10
    and not exists (
      select 1
      from public.reputation_notification_events
      where user_id = target_user_id
        and event_type = 'monthly_top_10'
        and created_at >= reset_month_start
    ) then
    perform public.factlens_queue_reputation_notification(
      target_user_id,
      'monthly_top_10',
      'You reached the monthly top 10',
      'You are now in the top 10 Verifact contributors this month.',
      jsonb_build_object('position', monthly_position)
    );
  end if;
end;
$$;

create or replace function public.factlens_points_multiplier(target_user_id uuid)
returns numeric
language sql
stable
as $$
  select case
    when coalesce(suspicious_flags, 0) > 0 then 0.5
    else 1
  end
  from public.profiles
  where id = target_user_id;
$$;

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

  return new;
end;
$$;

create or replace function public.factlens_set_vote_trust_weight()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  voter_tier text;
begin
  select trust_tier into voter_tier
  from public.profiles
  where id = new.user_id;

  new.vote_value := case
    when new.vote_type = 'TRUE' then 1.0
    when new.vote_type = 'FAKE' then 0.0
    else 0.5
  end;
  new.trust_weight := public.factlens_vote_weight_for_tier(voter_tier);
  new.accepted := coalesce(new.accepted, true);
  new.suspicious := coalesce(new.suspicious, false);

  return new;
end;
$$;

drop trigger if exists factlens_set_vote_trust_weight on public.votes;
create trigger factlens_set_vote_trust_weight
before insert on public.votes
for each row
execute function public.factlens_set_vote_trust_weight();

drop trigger if exists factlens_valid_vote_reputation on public.votes;
create trigger factlens_valid_vote_reputation
after insert on public.votes
for each row
execute function public.factlens_handle_valid_vote_reputation();

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
  points := greatest(
    0,
    round((10 + case when coalesce(new.source_quality_score, 0) >= 85 then 50 else 0 end) * multiplier)
  );

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

  if coalesce(new.source_quality_score, 0) >= 85 then
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

drop trigger if exists factlens_evidence_reputation on public.evidence;
create trigger factlens_evidence_reputation
after insert on public.evidence
for each row
execute function public.factlens_handle_evidence_reputation();

create or replace function public.process_claim_reputation(target_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  claim_row public.claims%rowtype;
  final_vote_type text;
  vote_row public.votes%rowtype;
  evidence_row public.evidence%rowtype;
  vote_matches boolean;
  evidence_matches boolean;
  multiplier numeric;
  rep_delta integer;
begin
  select * into claim_row
  from public.claims
  where id = target_claim_id
  for update;

  if not found or claim_row.reputation_processed_at is not null then
    return;
  end if;

  if claim_row.status in ('FINALIZED_TRUE', 'COMMUNITY_TRUE') then
    final_vote_type := 'TRUE';
  elsif claim_row.status in ('FINALIZED_FAKE', 'COMMUNITY_FAKE') then
    final_vote_type := 'FAKE';
  else
    update public.claims
    set reputation_processed_at = now()
    where id = target_claim_id;
    return;
  end if;

  if coalesce(claim_row.suspicious_activity, false) then
    update public.claims
    set reputation_processed_at = now()
    where id = target_claim_id;
    return;
  end if;

  for vote_row in
    select *
    from public.votes
    where claim_id = target_claim_id
      and coalesce(accepted, true) = true
      and user_id <> claim_row.author_id
  loop
    vote_matches := vote_row.vote_type = final_vote_type;
    multiplier := coalesce(public.factlens_points_multiplier(vote_row.user_id), 1);
    rep_delta := case
      when vote_matches then greatest(0, round(25 * multiplier))
      else greatest(0, round(5 * multiplier))
    end;

    perform public.factlens_record_reputation_event(
      target_claim_id,
      vote_row.user_id,
      vote_row.id,
      null,
      case when vote_matches then 'vote_matched_final_verdict' else 'vote_missed_final_verdict' end,
      case when vote_matches then 1 else -1 end,
      rep_delta,
      rep_delta,
      case when vote_matches then 1 else 0 end,
      case when vote_matches then 0 else 1 end,
      0,
      0
    );

    perform public.factlens_apply_profile_delta(
      vote_row.user_id,
      case when vote_matches then 1 else -1 end,
      rep_delta,
      rep_delta,
      case when vote_matches then 1 else 0 end,
      case when vote_matches then 0 else 1 end,
      0,
      0,
      0,
      0,
      'claim_finalized_vote'
    );
  end loop;

  for evidence_row in
    select distinct on (user_id) *
    from public.evidence
    where claim_id = target_claim_id
      and user_id <> claim_row.author_id
    order by user_id, created_at asc
  loop
    evidence_matches :=
      (final_vote_type = 'TRUE' and evidence_row.evidence_type = 'SUPPORTS_TRUE') or
      (final_vote_type = 'FAKE' and evidence_row.evidence_type = 'SUPPORTS_FAKE');

    if evidence_matches then
      multiplier := coalesce(public.factlens_points_multiplier(evidence_row.user_id), 1);
      rep_delta := greatest(0, round(20 * multiplier));

      perform public.factlens_record_reputation_event(
        target_claim_id,
        evidence_row.user_id,
        null,
        evidence_row.id,
        'evidence_supported_final_verdict',
        2,
        rep_delta,
        rep_delta,
        0,
        0,
        1,
        0
      );

      perform public.factlens_apply_profile_delta(
        evidence_row.user_id,
        2,
        rep_delta,
        rep_delta,
        0,
        0,
        0,
        0,
        1,
        0,
        'helpful_evidence'
      );

      perform public.factlens_queue_reputation_notification(
        evidence_row.user_id,
        'helpful_evidence',
        'Your evidence helped',
        'Your evidence supported a finalized Verifact result.',
        jsonb_build_object('claim_id', target_claim_id)
      );
    end if;
  end loop;

  update public.claims
  set reputation_processed_at = now()
  where id = target_claim_id;
end;
$$;

create or replace function public.reverse_claim_reputation(target_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.claim_reputation_events%rowtype;
begin
  for event_row in
    select *
    from public.claim_reputation_events
    where claim_id = target_claim_id
      and reversed_at is null
  loop
    perform public.factlens_apply_profile_delta(
      event_row.user_id,
      -coalesce(event_row.trust_delta, 0),
      -coalesce(event_row.reputation_delta, 0),
      -coalesce(event_row.monthly_delta, 0),
      -coalesce(event_row.correct_vote_delta, 0),
      -coalesce(event_row.incorrect_vote_delta, 0),
      0,
      0,
      -coalesce(event_row.helpful_evidence_delta, 0),
      -coalesce(event_row.suspicious_flags_delta, 0),
      'admin_overturn_reversal'
    );

    update public.claim_reputation_events
    set reversed_at = now()
    where id = event_row.id;
  end loop;

  update public.claims
  set reputation_processed_at = null
  where id = target_claim_id;
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
end;
$$;

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
      else 0.5
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
        else 0.5
      end * coalesce(trust_weight, 1.0)
    ) / nullif(sum(coalesce(trust_weight, 1.0)), 0),
    0.5
  )
  into weighted_score
  from public.votes
  where claim_id = target_claim_id
    and accepted = true;

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

grant execute on function public.process_claim_reputation(uuid) to authenticated;
revoke all on function public.reverse_claim_reputation(uuid) from anon, authenticated;
grant execute on function public.reverse_claim_reputation(uuid) to service_role;
revoke all on function public.reject_evidence_for_reputation(uuid, boolean) from anon, authenticated;
grant execute on function public.reject_evidence_for_reputation(uuid, boolean) to service_role;
grant execute on function public.recalculate_claim_vote_scores(uuid) to authenticated;

notify pgrst, 'reload schema';
