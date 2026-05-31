-- PHASE 4 STEP 7
-- Adds AI claim classification for factual, opinion, satire, question, promotion, or unclear posts.

alter table public.claims
add column if not exists claim_type text default 'UNCLEAR';

update public.claims
set claim_type = coalesce(claim_type, 'UNCLEAR')
where claim_type is null;
