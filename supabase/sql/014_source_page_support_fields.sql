-- PHASE 4 STEP 21
alter table public.claims
add column if not exists source_read_status text default 'not_read',
add column if not exists source_page_title text,
add column if not exists source_excerpt text,
add column if not exists source_supports_claim boolean,
add column if not exists source_support_summary text;

notify pgrst, 'reload schema';
