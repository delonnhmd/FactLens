-- PHASE 3 STEP 6
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (
    reason in (
      'SPAM',
      'FAKE_SOURCE',
      'DUPLICATE_CLAIM',
      'HARMFUL_CONTENT',
      'MISLEADING_TITLE',
      'HARASSMENT_OR_ABUSE',
      'OTHER'
    )
  ),
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (claim_id, user_id)
);

alter table public.reports enable row level security;

create index if not exists reports_claim_id_idx on public.reports (claim_id);
create index if not exists reports_user_id_idx on public.reports (user_id);
create index if not exists reports_created_at_idx on public.reports (created_at desc);

create or replace function public.set_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_reports_updated_at on public.reports;

create trigger set_reports_updated_at
before update on public.reports
for each row
execute function public.set_reports_updated_at();

create or replace function public.recalculate_claim_report_count(target_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_report_count integer;
begin
  select count(*)::integer
  into next_report_count
  from public.reports
  where claim_id = target_claim_id;

  update public.claims
  set
    report_count = next_report_count,
    is_flagged = next_report_count >= 3,
    updated_at = now()
  where id = target_claim_id;
end;
$$;

grant execute on function public.recalculate_claim_report_count(uuid) to authenticated;

drop policy if exists "Logged-in users can read reports" on public.reports;
drop policy if exists "Users can insert their own reports" on public.reports;
drop policy if exists "Users can update their own reports" on public.reports;
drop policy if exists "Users can delete their own reports" on public.reports;

create policy "Logged-in users can read reports"
on public.reports
for select
to authenticated
using (true);

create policy "Users can insert their own reports"
on public.reports
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own reports"
on public.reports
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own reports"
on public.reports
for delete
to authenticated
using (auth.uid() = user_id);
