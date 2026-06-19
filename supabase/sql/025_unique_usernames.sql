-- Enforce case-insensitive unique usernames for Verifact profiles.
alter table public.profiles
add column if not exists username_normalized text;

create or replace function public.normalize_profile_username(input text)
returns text
language sql
immutable
as $$
  select lower(trim(regexp_replace(coalesce(input, ''), '^@+', '')));
$$;

update public.profiles
set username_normalized = public.normalize_profile_username(username)
where username_normalized is null
   or username_normalized <> public.normalize_profile_username(username);

with ranked_profiles as (
  select
    id,
    username,
    display_name,
    username_normalized,
    row_number() over (
      partition by username_normalized
      order by created_at nulls last, id
    ) as duplicate_rank
  from public.profiles
  where username_normalized is not null
),
duplicate_profiles as (
  select
    id,
    username,
    display_name,
    username_normalized,
    lower(
      left(
        coalesce(nullif(regexp_replace(username_normalized, '[^a-z0-9_]', '', 'g'), ''), 'user'),
        greatest(3, 20 - 7)
      ) || '_' || substring(md5(id::text), 1, 6)
    ) as next_username
  from ranked_profiles
  where duplicate_rank > 1
)
update public.profiles as profiles
set
  username = duplicate_profiles.next_username,
  display_name = case
    when profiles.display_name is null
      or public.normalize_profile_username(profiles.display_name) = duplicate_profiles.username_normalized
      then duplicate_profiles.next_username
    else profiles.display_name
  end,
  username_normalized = duplicate_profiles.next_username,
  updated_at = now()
from duplicate_profiles
where profiles.id = duplicate_profiles.id;

update public.profiles
set
  username = public.normalize_profile_username(username),
  display_name = case
    when display_name is null
      or public.normalize_profile_username(display_name) = username_normalized
      then public.normalize_profile_username(username)
    else display_name
  end,
  username_normalized = public.normalize_profile_username(username),
  updated_at = now()
where username <> public.normalize_profile_username(username)
   or username_normalized <> public.normalize_profile_username(username);

with ranked_display_names as (
  select
    id,
    row_number() over (
      partition by public.normalize_profile_username(display_name)
      order by created_at nulls last, id
    ) as duplicate_rank
  from public.profiles
  where display_name is not null
    and trim(display_name) <> ''
    and not coalesce(is_deleted, false)
),
duplicate_display_names as (
  select id
  from ranked_display_names
  where duplicate_rank > 1
)
update public.profiles as profiles
set
  display_name = profiles.username,
  updated_at = now()
from duplicate_display_names
where profiles.id = duplicate_display_names.id;

alter table public.profiles
alter column username_normalized set not null;

create unique index if not exists profiles_username_normalized_unique
on public.profiles (username_normalized);

create unique index if not exists profiles_display_name_normalized_unique
on public.profiles (public.normalize_profile_username(display_name))
where display_name is not null
  and trim(display_name) <> ''
  and not coalesce(is_deleted, false);

create or replace function public.set_profile_username_normalized()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.username := public.normalize_profile_username(new.username);
  new.username_normalized := public.normalize_profile_username(new.username);
  return new;
end;
$$;

drop trigger if exists set_profile_username_normalized on public.profiles;

create trigger set_profile_username_normalized
before insert or update of username, display_name
on public.profiles
for each row
execute function public.set_profile_username_normalized();

alter table public.profiles
drop constraint if exists profiles_username_format_check;

alter table public.profiles
add constraint profiles_username_format_check
check (
  username = public.normalize_profile_username(username)
  and username ~ '^[a-z0-9_]{3,20}$'
)
not valid;
