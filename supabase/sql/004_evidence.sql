-- PHASE 3 STEP 5
create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  evidence_type text not null check (evidence_type in ('SUPPORTS_TRUE', 'SUPPORTS_FAKE', 'ADDS_CONTEXT', 'UNCLEAR')),
  url text not null,
  note text not null,
  source_quality_label text,
  source_quality_score integer,
  source_quality_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.evidence enable row level security;

create index if not exists evidence_claim_id_idx on public.evidence (claim_id);
create index if not exists evidence_user_id_idx on public.evidence (user_id);
create index if not exists evidence_created_at_idx on public.evidence (created_at desc);

create or replace function public.set_evidence_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_evidence_updated_at on public.evidence;

create trigger set_evidence_updated_at
before update on public.evidence
for each row
execute function public.set_evidence_updated_at();

create or replace function public.recalculate_claim_evidence_count(target_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.claims
  set
    evidence_count = (
      select count(*)::integer
      from public.evidence
      where claim_id = target_claim_id
    ),
    updated_at = now()
  where id = target_claim_id;
end;
$$;

grant execute on function public.recalculate_claim_evidence_count(uuid) to authenticated;

drop policy if exists "Anyone can read evidence" on public.evidence;
drop policy if exists "Users can insert their own evidence" on public.evidence;
drop policy if exists "Users can update their own evidence" on public.evidence;
drop policy if exists "Users can delete their own evidence" on public.evidence;

create policy "Anyone can read evidence"
on public.evidence
for select
using (true);

create policy "Users can insert their own evidence"
on public.evidence
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own evidence"
on public.evidence
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own evidence"
on public.evidence
for delete
to authenticated
using (auth.uid() = user_id);
