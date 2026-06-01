-- PHASE 4 STEP 9
-- Adds source credibility scoring fields for AI pre-check source metadata.

alter table public.claims
add column if not exists source_domain text,
add column if not exists source_score integer,
add column if not exists source_reason text;
