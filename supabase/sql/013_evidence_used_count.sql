-- PHASE 4 STEP 10
-- Tracks how many community evidence links were considered during AI retry.

alter table public.claims
add column if not exists evidence_used_count integer default 0;
