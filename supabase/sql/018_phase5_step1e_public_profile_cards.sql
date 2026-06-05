-- PHASE 5 STEP 1E
-- Public profile card fields for contributor identity.

alter table public.profiles
add column if not exists avatar_url text,
add column if not exists bio text,
add column if not exists public_profile_slug text,
add column if not exists profile_visibility text default 'public';

create unique index if not exists idx_profiles_public_profile_slug
on public.profiles (public_profile_slug)
where public_profile_slug is not null;

create index if not exists idx_profiles_profile_visibility
on public.profiles (profile_visibility);

update public.profiles
set public_profile_slug =
  trim(both '-' from lower(regexp_replace(coalesce(username, 'user'), '[^a-zA-Z0-9]+', '-', 'g'))) ||
  '-' ||
  right(replace(id::text, '-', ''), 6)
where public_profile_slug is null
  and username is not null;

notify pgrst, 'reload schema';
