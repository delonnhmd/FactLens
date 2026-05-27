-- PHASE 3 STEP 3
create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  source_url text not null,
  video_url text,
  image_url text,
  category text default 'Other',
  slug text,
  share_url text,
  votes_true integer default 0,
  votes_fake integer default 0,
  votes_unsure integer default 0,
  status text default 'OPEN',
  ai_status text default 'PENDING',
  ai_confidence integer,
  ai_reason text,
  report_count integer default 0,
  evidence_count integer default 0,
  is_flagged boolean default false,
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  updated_at timestamptz default now()
);

alter table public.claims enable row level security;

create index if not exists claims_created_at_idx on public.claims (created_at desc);
create index if not exists claims_author_id_idx on public.claims (author_id);

create or replace function public.set_claims_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_claims_updated_at on public.claims;

create trigger set_claims_updated_at
before update on public.claims
for each row
execute function public.set_claims_updated_at();

drop policy if exists "Anyone can read claims" on public.claims;
drop policy if exists "Users can insert their own claims" on public.claims;
drop policy if exists "Authors can update their own claims" on public.claims;
drop policy if exists "Authors can delete their own claims" on public.claims;

create policy "Anyone can read claims"
on public.claims
for select
using (true);

create policy "Users can insert their own claims"
on public.claims
for insert
to authenticated
with check (auth.uid() = author_id);

create policy "Authors can update their own claims"
on public.claims
for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "Authors can delete their own claims"
on public.claims
for delete
to authenticated
using (auth.uid() = author_id);
