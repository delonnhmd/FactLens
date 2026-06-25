-- Ensure contributor profile pages have every public profile column used by the app.
-- Run this in Supabase SQL editor before App Review testing.

alter table public.profiles
add column if not exists avatar_url text,
add column if not exists bio text,
add column if not exists public_profile_slug text,
add column if not exists profile_visibility text default 'public',
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
add column if not exists highest_rank_achieved text default 'New Scout',
add column if not exists monthly_reputation_points integer default 0,
add column if not exists monthly_reset_at timestamptz default now(),
add column if not exists is_deleted boolean default false,
add column if not exists deleted_at timestamptz,
add column if not exists username_normalized text;

create or replace function public.normalize_profile_username(input text)
returns text
language sql
immutable
as $$
  select lower(trim(regexp_replace(coalesce(input, ''), '^@+', '')));
$$;

update public.profiles
set
  username_normalized = public.normalize_profile_username(username),
  profile_visibility = coalesce(profile_visibility, 'public'),
  public_profile_slug = coalesce(
    public_profile_slug,
    trim(both '-' from lower(regexp_replace(coalesce(username, 'user'), '[^a-zA-Z0-9]+', '-', 'g'))) ||
      '-' ||
      right(replace(id::text, '-', ''), 6)
  )
where username is not null;

create index if not exists idx_profiles_public_profile_slug_lookup
on public.profiles (public_profile_slug)
where public_profile_slug is not null;

create index if not exists idx_profiles_profile_visibility
on public.profiles (profile_visibility);

create index if not exists idx_profiles_username_normalized
on public.profiles (username_normalized);

alter table public.profiles enable row level security;

drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Anyone can read public profiles" on public.profiles;

create policy "Public profiles are viewable by everyone"
on public.profiles
for select
to anon, authenticated
using (true);

grant select on table public.profiles to anon, authenticated;
grant execute on function public.normalize_profile_username(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
