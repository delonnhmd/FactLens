-- Adds separate political lean metadata for source transparency.
-- Credibility score remains based on journalistic standards only.

alter table public.claims
add column if not exists source_lean text;
