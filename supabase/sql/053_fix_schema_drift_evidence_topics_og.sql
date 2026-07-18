-- STEP 1 — SCHEMA DRIFT FIX (additive, zero-downtime)
-- Reconciles production with columns the code already reads/writes.
--
-- Two live Postgres errors this resolves:
--   1) "column evidence.image_url does not exist"      (x3)
--   2) "column claim_topics.og_title does not exist"   (x2)
--
-- Root cause: migration 022_phase5_step6_image_upload.sql added image columns to
-- BOTH claims and evidence, but only the claims portion reached production
-- (partial manual apply). And factfight-web reads og_title/og_description from
-- claim_topics, which never had those columns.

-- 1a. evidence image columns (022 intended these; only claims got them).
--     evidenceService.ts:434-436 UPDATEs all THREE on image-bearing evidence.
alter table public.evidence
  add column if not exists image_url text,
  add column if not exists image_path text,
  add column if not exists thumbnail_url text;

-- 1b. claim_topics OG columns (read by factfight-web topics.ts for topic-page SEO).
alter table public.claim_topics
  add column if not exists og_title text,
  add column if not exists og_description text;

-- Backfill existing topic rows so OG tags render immediately.
update public.claim_topics
set og_title = coalesce(og_title, meta_title),
    og_description = coalesce(og_description, meta_description)
where og_title is null or og_description is null;

-- Make PostgREST pick up the new columns immediately.
notify pgrst, 'reload schema';
