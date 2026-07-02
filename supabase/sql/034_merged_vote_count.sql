-- PHASE 6 STEP 1 — Count votes for a canonical claim across its merged cluster.
--
-- The "cluster" of a canonical claim is: the canonical claim itself, plus every
-- claim that was merged into it (canonical_claim_id = the canonical id).
--
-- Dedup rule: a user may have voted on several claims in the cluster (they voted
-- on a duplicate before it was merged). We count each such user only ONCE, using
-- their most recent vote (by created_at). votes is UNIQUE(claim_id, user_id), so
-- a user has at most one vote per claim but can appear on multiple cluster claims.
--
-- No endpoint yet — this is provided both as a raw query (below, commented) and
-- as a reusable function so it can be wired up later without duplicating logic.

-- ---------------------------------------------------------------------------
-- Raw query form (replace :canonical_id with the canonical claim's uuid):
--
--   with cluster_claims as (
--     select id from public.claims where id = :canonical_id
--     union
--     select id from public.claims where canonical_claim_id = :canonical_id
--   ),
--   latest_vote_per_user as (
--     select distinct on (v.user_id)
--       v.user_id,
--       v.vote_type
--     from public.votes v
--     join cluster_claims cc on cc.id = v.claim_id
--     order by v.user_id, v.created_at desc
--   )
--   select
--     count(*)::integer                                              as total_votes,
--     count(*) filter (where vote_type = 'TRUE')::integer            as votes_true,
--     count(*) filter (where vote_type = 'FAKE')::integer            as votes_fake,
--     count(*) filter (where vote_type = 'UNSURE')::integer          as votes_unsure
--   from latest_vote_per_user;
-- ---------------------------------------------------------------------------

create or replace function public.count_cluster_votes(canonical_id uuid)
returns table (
  total_votes integer,
  votes_true integer,
  votes_fake integer,
  votes_unsure integer
)
language sql
stable
security definer
set search_path = public
as $$
  with cluster_claims as (
    -- The canonical claim itself...
    select id from public.claims where id = canonical_id
    union
    -- ...plus everything merged into it.
    select id from public.claims where canonical_claim_id = canonical_id
  ),
  latest_vote_per_user as (
    -- One row per user: their most recent vote anywhere in the cluster.
    select distinct on (v.user_id)
      v.user_id,
      v.vote_type
    from public.votes v
    join cluster_claims cc on cc.id = v.claim_id
    order by v.user_id, v.created_at desc
  )
  select
    count(*)::integer                                     as total_votes,
    count(*) filter (where vote_type = 'TRUE')::integer   as votes_true,
    count(*) filter (where vote_type = 'FAKE')::integer   as votes_fake,
    count(*) filter (where vote_type = 'UNSURE')::integer as votes_unsure
  from latest_vote_per_user;
$$;

grant execute on function public.count_cluster_votes(uuid) to service_role;
