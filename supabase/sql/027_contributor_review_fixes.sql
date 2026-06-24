-- Apple review fixes for contributor profiles and leaderboard usernames.
-- Run this in the Supabase SQL editor for the production project.

alter table public.profiles
add column if not exists is_deleted boolean default false;

alter table public.profiles
add column if not exists profile_visibility text default 'public';

alter table public.profiles
add column if not exists public_profile_slug text;

alter table public.profiles
add column if not exists username_normalized text;

create or replace function public.normalize_profile_username(input text)
returns text
language sql
immutable
as $$
  select lower(trim(regexp_replace(coalesce(input, ''), '^@+', '')));
$$;

create or replace function public.review_safe_default_username(input_seed text, attempt integer default 0)
returns text
language sql
immutable
as $$
  select 'user_' || lpad(
    (
      1000 + (
        (('x' || substr(md5(coalesce(input_seed, 'user') || ':' || coalesce(attempt, 0)::text), 1, 8))::bit(32)::bigint % 9000)
      )
    )::text,
    4,
    '0'
  );
$$;

with placeholder_profiles as (
  select
    id,
    created_at,
    row_number() over (order by created_at nulls last, id) as profile_order
  from public.profiles
  where public.normalize_profile_username(username) in ('verifact_a8f857', 'factlens_abc123')
     or public.normalize_profile_username(username) ~ '^[a-z][a-z0-9]{2,12}_[a-f0-9]{6}$'
),
generated_candidates as (
  select
    placeholder_profiles.id,
    attempt,
    public.review_safe_default_username(placeholder_profiles.id::text || ':' || placeholder_profiles.profile_order::text, attempt) as candidate
  from placeholder_profiles
  cross join generate_series(0, 100) as attempts(attempt)
),
available_candidates as (
  select
    generated_candidates.*,
    row_number() over (partition by generated_candidates.candidate order by generated_candidates.attempt, generated_candidates.id) as candidate_rank
  from generated_candidates
  where not exists (
    select 1
    from public.profiles existing_profiles
    where existing_profiles.id <> generated_candidates.id
      and public.normalize_profile_username(existing_profiles.username) = generated_candidates.candidate
  )
),
chosen_usernames as (
  select distinct on (id)
    id,
    candidate as new_username
  from available_candidates
  where candidate_rank = 1
  order by id, attempt
)
update public.profiles as profiles
set
  username = chosen_usernames.new_username,
  display_name = chosen_usernames.new_username,
  username_normalized = public.normalize_profile_username(chosen_usernames.new_username),
  public_profile_slug = chosen_usernames.new_username || '-' || right(replace(profiles.id::text, '-', ''), 6),
  updated_at = now()
from chosen_usernames
where profiles.id = chosen_usernames.id;

update public.profiles
set username_normalized = public.normalize_profile_username(username)
where username_normalized is null
   or username_normalized <> public.normalize_profile_username(username);

alter table public.profiles enable row level security;

drop policy if exists "Public profiles are viewable by everyone" on public.profiles;

create policy "Public profiles are viewable by everyone"
on public.profiles
for select
to anon, authenticated
using (
  not coalesce(is_deleted, false)
  and coalesce(profile_visibility, 'public') = 'public'
);

grant select on table public.profiles to anon, authenticated;
grant execute on function public.normalize_profile_username(text) to anon, authenticated, service_role;
grant execute on function public.review_safe_default_username(text, integer) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
