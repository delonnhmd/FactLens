-- PHASE 3 STEP 4
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  vote_type text not null check (vote_type in ('TRUE', 'FAKE', 'UNSURE')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (claim_id, user_id)
);

alter table public.votes enable row level security;

create index if not exists votes_claim_id_idx on public.votes (claim_id);
create index if not exists votes_user_id_idx on public.votes (user_id);

create or replace function public.set_votes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_votes_updated_at on public.votes;

create trigger set_votes_updated_at
before update on public.votes
for each row
execute function public.set_votes_updated_at();

create or replace function public.recalculate_claim_vote_counts(target_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.claims
  set
    votes_true = (
      select count(*)::integer
      from public.votes
      where claim_id = target_claim_id and vote_type = 'TRUE'
    ),
    votes_fake = (
      select count(*)::integer
      from public.votes
      where claim_id = target_claim_id and vote_type = 'FAKE'
    ),
    votes_unsure = (
      select count(*)::integer
      from public.votes
      where claim_id = target_claim_id and vote_type = 'UNSURE'
    ),
    updated_at = now()
  where id = target_claim_id;
end;
$$;

grant execute on function public.recalculate_claim_vote_counts(uuid) to authenticated;

drop policy if exists "Logged-in users can read votes" on public.votes;
drop policy if exists "Users can insert their own votes" on public.votes;
drop policy if exists "Users can update their own votes" on public.votes;
drop policy if exists "Users can delete their own votes" on public.votes;

create policy "Logged-in users can read votes"
on public.votes
for select
to authenticated
using (true);

create policy "Users can insert their own votes"
on public.votes
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own votes"
on public.votes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own votes"
on public.votes
for delete
to authenticated
using (auth.uid() = user_id);
