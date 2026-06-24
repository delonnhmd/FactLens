-- Add @mention tagging for users and verified organizations.
-- Run this in Supabase SQL editor before relying on mention tagging live.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  avatar_url text,
  verified boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.claim_tags (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  tagged_user_id uuid references public.profiles(id) on delete cascade,
  tagged_org_id uuid references public.organizations(id) on delete cascade,
  tagged_username text not null,
  created_at timestamptz default now()
);

create table if not exists public.evidence_tags (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence(id) on delete cascade,
  tagged_user_id uuid references public.profiles(id) on delete cascade,
  tagged_org_id uuid references public.organizations(id) on delete cascade,
  tagged_username text not null,
  created_at timestamptz default now()
);

alter table public.profiles
add column if not exists notifications jsonb default '[]'::jsonb;

create index if not exists idx_claim_tags_claim_id
on public.claim_tags (claim_id);

create index if not exists idx_claim_tags_user_id
on public.claim_tags (tagged_user_id);

create index if not exists idx_claim_tags_org_id
on public.claim_tags (tagged_org_id);

create unique index if not exists claim_tags_unique_user_per_claim
on public.claim_tags (claim_id, tagged_user_id)
where tagged_user_id is not null;

create unique index if not exists claim_tags_unique_org_per_claim
on public.claim_tags (claim_id, tagged_org_id)
where tagged_org_id is not null;

create index if not exists idx_evidence_tags_evidence_id
on public.evidence_tags (evidence_id);

create index if not exists idx_evidence_tags_user_id
on public.evidence_tags (tagged_user_id);

create index if not exists idx_evidence_tags_org_id
on public.evidence_tags (tagged_org_id);

create unique index if not exists evidence_tags_unique_user_per_evidence
on public.evidence_tags (evidence_id, tagged_user_id)
where tagged_user_id is not null;

create unique index if not exists evidence_tags_unique_org_per_evidence
on public.evidence_tags (evidence_id, tagged_org_id)
where tagged_org_id is not null;

create index if not exists idx_organizations_slug
on public.organizations (slug);

create index if not exists idx_organizations_name
on public.organizations (name);

alter table public.organizations enable row level security;
alter table public.claim_tags enable row level security;
alter table public.evidence_tags enable row level security;

drop policy if exists "Organizations are public" on public.organizations;
create policy "Organizations are public"
on public.organizations
for select
using (true);

drop policy if exists "Claim tags are public" on public.claim_tags;
create policy "Claim tags are public"
on public.claim_tags
for select
using (true);

drop policy if exists "Users can insert claim tags" on public.claim_tags;
create policy "Users can insert claim tags"
on public.claim_tags
for insert
with check (auth.uid() is not null);

drop policy if exists "Evidence tags are public" on public.evidence_tags;
create policy "Evidence tags are public"
on public.evidence_tags
for select
using (true);

drop policy if exists "Users can insert evidence tags" on public.evidence_tags;
create policy "Users can insert evidence tags"
on public.evidence_tags
for insert
with check (auth.uid() is not null);

grant select on public.organizations to anon, authenticated;
grant select on public.claim_tags to anon, authenticated;
grant select on public.evidence_tags to anon, authenticated;
grant insert on public.claim_tags to authenticated;
grant insert on public.evidence_tags to authenticated;

notify pgrst, 'reload schema';
