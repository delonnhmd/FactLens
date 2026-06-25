-- Fix contributor profile fetches by restoring a readable profiles SELECT policy.
-- Run this in Supabase SQL editor if contributor profile reads return RLS/not-found errors.

alter table public.profiles enable row level security;

drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Anyone can read public profiles" on public.profiles;

create policy "Public profiles are viewable by everyone"
on public.profiles
for select
to anon, authenticated
using (true);

grant select on table public.profiles to anon, authenticated;

notify pgrst, 'reload schema';
