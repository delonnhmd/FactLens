-- In-app notifications for mentions, badges, and finalized claims.
-- Run this in Supabase SQL editor before relying on notifications live.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  claim_id uuid references public.claims(id) on delete set null,
  read boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_notifications_user_id
on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
on public.notifications
for select
using (auth.uid() = user_id);

drop policy if exists "System can insert notifications" on public.notifications;
create policy "System can insert notifications"
on public.notifications
for insert
to service_role
with check (true);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
on public.notifications
for update
using (auth.uid() = user_id);

revoke insert on public.notifications from anon, authenticated;
grant select, update on public.notifications to authenticated;
grant insert on public.notifications to service_role;

create or replace function public.factlens_notification_verdict_label(status_value text)
returns text
language sql
immutable
as $$
  select case status_value
    when 'FINALIZED_TRUE' then 'True'
    when 'COMMUNITY_TRUE' then 'True'
    when 'FINALIZED_FAKE' then 'Fake'
    when 'COMMUNITY_FAKE' then 'Fake'
    when 'NEEDS_MORE_EVIDENCE' then 'Insufficient data'
    else 'Insufficient data'
  end;
$$;

create or replace function public.factlens_notify_claim_finalized()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.author_id is null then
    return new;
  end if;

  if coalesce(old.status, '') = coalesce(new.status, '') then
    return new;
  end if;

  if new.status not in (
    'FINALIZED_TRUE',
    'FINALIZED_FAKE',
    'INSUFFICIENT_DATA',
    'COMMUNITY_TRUE',
    'COMMUNITY_FAKE',
    'NEEDS_MORE_EVIDENCE'
  ) then
    return new;
  end if;

  insert into public.notifications(user_id, type, title, body, claim_id)
  values (
    new.author_id,
    'claim_finalized',
    'Your claim has been verified',
    'Community verdict: ' || public.factlens_notification_verdict_label(new.status),
    new.id
  );

  return new;
end;
$$;

drop trigger if exists factlens_claim_finalized_notifications on public.claims;
create trigger factlens_claim_finalized_notifications
after update of status on public.claims
for each row
execute function public.factlens_notify_claim_finalized();

create or replace function public.factlens_notify_badge_earned()
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
    where not exists (
      select 1
      from jsonb_array_elements(coalesce(old.badge_list, '[]'::jsonb)) old_badge
      where old_badge->>'id' = value->>'id'
    )
  loop
    badge_name := coalesce(badge->>'name', 'New badge');

    insert into public.notifications(user_id, type, title, body)
    values (
      new.id,
      'badge_earned',
      'You earned the ' || badge_name || ' badge',
      'Keep verifying claims to unlock more badges.'
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists factlens_badge_earned_notifications on public.profiles;
create trigger factlens_badge_earned_notifications
after update of badge_list on public.profiles
for each row
execute function public.factlens_notify_badge_earned();

notify pgrst, 'reload schema';
