-- PHASE 5 STEP 4
-- Account deletion compliance fields.

alter table public.profiles
add column if not exists is_deleted boolean default false,
add column if not exists deleted_at timestamptz;

create index if not exists idx_profiles_is_deleted
on public.profiles (is_deleted);

notify pgrst, 'reload schema';
