-- PHASE 6 STEP 1 — Duplicate claim detection (semantic similarity)
--
-- ADDITIVE ONLY. This migration never alters or drops existing columns,
-- constraints, or data. It adds the pgvector extension, two nullable columns
-- on public.claims, one index, and one read-only RPC used by the backend.
--
-- Run this as-is in the Supabase SQL editor. It is idempotent (safe to re-run).

-- 1. pgvector — required for the embedding column and cosine-distance search.
create extension if not exists vector;

-- 2. New nullable columns on claims.
--    embedding: 1536-dim vector from OpenAI text-embedding-3-small.
--    canonical_claim_id: when a claim is merged into another, it points at the
--    surviving ("canonical") claim. NULL means this claim is itself canonical.
--    Both are nullable so existing rows and any claim whose embedding failed to
--    generate remain valid — embedding is never required to create a claim.
alter table public.claims
add column if not exists embedding vector(1536),
add column if not exists canonical_claim_id uuid references public.claims(id);

-- 3. Vector index — HNSW (not IVFFlat), justified:
--    * This table is under 100k rows. IVFFlat needs a representative amount of
--      data ALREADY PRESENT at build time to cluster its lists; building it on a
--      small/empty table gives poor recall and would need periodic REINDEX as the
--      table grows. HNSW needs no training step and stays accurate as rows are
--      inserted incrementally (which is exactly our pattern: claims trickle in).
--    * HNSW gives higher recall at low latency for small-to-medium tables; the
--      only real cost is slower build + more memory, both negligible under 100k.
--    We index cosine distance because embeddings are compared by cosine similarity.
create index if not exists claims_embedding_hnsw_idx
on public.claims
using hnsw (embedding vector_cosine_ops);

-- 4. Read-only similarity search RPC.
--    supabase-py's query builder cannot express the pgvector `<=>` operator, so
--    the backend calls this function via supabase.rpc("match_claims", ...).
--    WHY a SECURITY DEFINER function with an explicit allowed-status list:
--    the backend (service role) needs to search across claims, and callers must
--    only ever be suggested a claim that is (a) still open for voting and
--    (b) not itself a merged duplicate. Those rules live here so they cannot be
--    bypassed by a malformed request.
--
--    similarity = 1 - cosine_distance, so higher = more similar. We filter with
--    `> match_threshold` (strict) to mirror the "> 0.85" spec and order by raw
--    distance so the HNSW index is used.
create or replace function public.match_claims(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  allowed_statuses text[]
)
returns table (
  id uuid,
  title text,
  similarity float,
  vote_count integer,
  verdict_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.title,
    (1 - (c.embedding <=> query_embedding))::float as similarity,
    coalesce(c.total_votes, 0) as vote_count,
    c.status as verdict_status
  from public.claims c
  where c.embedding is not null
    and c.canonical_claim_id is null
    and c.status = any(allowed_statuses)
    and (1 - (c.embedding <=> query_embedding)) > match_threshold
  order by c.embedding <=> query_embedding asc
  limit match_count;
$$;

grant execute on function public.match_claims(vector, float, int, text[]) to service_role;
