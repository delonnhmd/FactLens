-- PHASE 6 STEP 4 — Topic Clustering
--
-- ADDITIVE ONLY. Adds one table, one nullable column on claims, indexes,
-- RLS policies, and one read-only RPC. Never alters or drops anything that
-- exists. Idempotent — safe to re-run in the Supabase SQL editor.
--
-- Requires the pgvector extension, already installed by
-- 033_duplicate_claim_detection.sql (`create extension if not exists vector`).

-- 1. Topic cluster: one row per topic, groups related claims.
create table if not exists public.claim_topics (
  id uuid primary key default gen_random_uuid(),

  -- Human-readable topic label (AI-generated)
  topic_label text not null,

  -- SEO fields
  slug text not null unique,
  meta_title text,           -- max 60 chars (enforced in topic_cluster_service)
  meta_description text,     -- max 160 chars (enforced in topic_cluster_service)
  keywords text[],           -- 5-10 keywords

  -- Cluster embedding. NOTE: per the service logic this is the embedding of
  -- the FIRST claim that created the cluster, not a live-recomputed centroid —
  -- recomputing a true centroid on every join would require reading every
  -- member embedding and is deliberately out of scope (documented, not built).
  embedding vector(1536),

  -- Aggregate verdict across all member claims.
  -- Recomputed by the backend (topic_cluster_service.update_cluster_stats),
  -- never set by users. "disputed" maps to the claims.votes_unsure column —
  -- the claims table has votes_true / votes_fake / votes_unsure and no
  -- disputed column; votes_unsure is the closest existing signal.
  total_true_votes int not null default 0,
  total_fake_votes int not null default 0,
  total_disputed_votes int not null default 0,
  total_vote_count int not null default 0,
  cluster_verdict text,
  -- 'TRUE' | 'FAKE' | 'DISPUTED' | 'INSUFFICIENT_DATA'

  claim_count int not null default 0,
  first_claim_at timestamptz,
  last_claim_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Nullable topic FK on claims — existing claims unaffected (null = no
--    cluster yet, and every existing flow treats null exactly as before).
alter table public.claims
  add column if not exists topic_cluster_id uuid references public.claim_topics(id);

-- 3. Indexes.
create index if not exists idx_claim_topics_slug
  on public.claim_topics (slug);
create index if not exists idx_claims_topic_cluster_id
  on public.claims (topic_cluster_id);

-- Vector index — HNSW instead of the spec's IVFFlat, for the same reason
-- documented in 033_duplicate_claim_detection.sql: IVFFlat needs a
-- representative amount of data present at build time to cluster its lists;
-- built on an empty/small table it gives poor recall and needs periodic
-- REINDEX. HNSW has no training step and stays accurate as rows trickle in,
-- which is exactly how clusters are created. claim_topics will be far smaller
-- than claims, so build cost is negligible.
create index if not exists idx_claim_topics_embedding
  on public.claim_topics
  using hnsw (embedding vector_cosine_ops);

-- 4. RLS: topic clusters are public read; writes happen only through the
--    backend service role (which bypasses RLS — the service_role policy below
--    is kept from the spec for explicitness, but it is belt-and-suspenders).
alter table public.claim_topics enable row level security;

drop policy if exists "Anyone can read claim_topics"
  on public.claim_topics;
create policy "Anyone can read claim_topics"
  on public.claim_topics for select
  using (true);

drop policy if exists "Service role manages claim_topics"
  on public.claim_topics;
create policy "Service role manages claim_topics"
  on public.claim_topics for all
  to service_role
  using (true)
  with check (true);

-- 5. Read-only similarity RPC — same pattern (and same justification) as
--    match_claims in 033: supabase-py's query builder cannot express the
--    pgvector `<=>` operator, so the backend calls this via
--    supabase.rpc("match_claim_topics", ...).
--    similarity = 1 - cosine_distance (higher = more similar); filter is
--    strict `> match_threshold`; ordered by raw distance so the index is used.
create or replace function public.match_claim_topics(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  topic_label text,
  slug text,
  cluster_verdict text,
  total_true_votes int,
  total_fake_votes int,
  total_disputed_votes int,
  total_vote_count int,
  claim_count int,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.topic_label,
    t.slug,
    t.cluster_verdict,
    t.total_true_votes,
    t.total_fake_votes,
    t.total_disputed_votes,
    t.total_vote_count,
    t.claim_count,
    (1 - (t.embedding <=> query_embedding))::float as similarity
  from public.claim_topics t
  where t.embedding is not null
    and (1 - (t.embedding <=> query_embedding)) > match_threshold
  order by t.embedding <=> query_embedding asc
  limit match_count;
$$;

grant execute on function public.match_claim_topics(vector, float, int) to service_role;

notify pgrst, 'reload schema';
