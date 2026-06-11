-- Simple admin mode and moderation controls.

alter table public.profiles
add column if not exists is_admin boolean not null default false,
add column if not exists is_suspended boolean not null default false,
add column if not exists suspended_at timestamptz,
add column if not exists suspended_by uuid references public.profiles(id) on delete set null,
add column if not exists suspension_reason text;

alter table public.claims
add column if not exists is_featured boolean not null default false,
add column if not exists featured_at timestamptz,
add column if not exists featured_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_profiles_is_admin
on public.profiles (is_admin);

create index if not exists idx_profiles_is_suspended
on public.profiles (is_suspended);

create index if not exists idx_claims_is_featured_created
on public.claims (is_featured, created_at desc);

create or replace function public.current_user_can_submit()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and coalesce(is_suspended, false) = false
      and coalesce(is_deleted, false) = false
  );
$$;

grant execute on function public.current_user_can_submit() to authenticated;

create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'authenticated' then
    new.is_admin = old.is_admin;
    new.is_suspended = old.is_suspended;
    new.suspended_at = old.suspended_at;
    new.suspended_by = old.suspended_by;
    new.suspension_reason = old.suspension_reason;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_admin_fields on public.profiles;

create trigger protect_profile_admin_fields
before update on public.profiles
for each row
execute function public.protect_profile_admin_fields();

drop policy if exists "Users can insert their own claims" on public.claims;
drop policy if exists "Users can insert their own votes" on public.votes;
drop policy if exists "Users can update their own votes" on public.votes;
drop policy if exists "Users can insert their own evidence" on public.evidence;
drop policy if exists "Users can update their own evidence" on public.evidence;
drop policy if exists "Users can insert their own reports" on public.reports;
drop policy if exists "Users can update their own reports" on public.reports;

create policy "Users can insert their own claims"
on public.claims
for insert
to authenticated
with check (auth.uid() = author_id and public.current_user_can_submit());

create policy "Users can insert their own votes"
on public.votes
for insert
to authenticated
with check (auth.uid() = user_id and public.current_user_can_submit());

create policy "Users can update their own votes"
on public.votes
for update
to authenticated
using (auth.uid() = user_id and public.current_user_can_submit())
with check (auth.uid() = user_id and public.current_user_can_submit());

create policy "Users can insert their own evidence"
on public.evidence
for insert
to authenticated
with check (auth.uid() = user_id and public.current_user_can_submit());

create policy "Users can update their own evidence"
on public.evidence
for update
to authenticated
using (auth.uid() = user_id and public.current_user_can_submit())
with check (auth.uid() = user_id and public.current_user_can_submit());

create policy "Users can insert their own reports"
on public.reports
for insert
to authenticated
with check (auth.uid() = user_id and public.current_user_can_submit());

create policy "Users can update their own reports"
on public.reports
for update
to authenticated
using (auth.uid() = user_id and public.current_user_can_submit())
with check (auth.uid() = user_id and public.current_user_can_submit());

notify pgrst, 'reload schema';
