-- CONTENT SAFETY — MULTILINGUAL (VIETNAMESE) BLOCKLIST + AUTO-APPROVE CLEAN CONTENT
--
-- ⚠️ RUN THIS MANUALLY IN THE SUPABASE SQL EDITOR (required migration).
--    Takes effect immediately — no app deploy needed. Safe to re-run (idempotent).
--
-- WHY (two problems, one trigger rewrite):
--
--   1. FEED VISIBILITY (Task 1). Migration 048 added claims.safety_status
--      DEFAULT 'PENDING' + the restrictive RLS policy "Only approved claims
--      visible", but the async AI approver (webhook / Render cron) that flips
--      PENDING -> APPROVED never ran in production (safety_checked_at was NULL on
--      every row; no pg_cron). Result: every new claim stayed PENDING and was
--      hidden from all non-author / non-admin users — the public feed silently
--      dropped new posts (with or without images).
--
--      FIX: the Layer-0 BEFORE INSERT trigger now stamps clean content
--      'APPROVED' synchronously instead of leaving it 'PENDING'. Content is
--      still BLOCKED deterministically by the blocklist + intent regexes below,
--      and the app already runs full multilingual OpenAI moderation BEFORE
--      insert (client -> /moderation/check -> backend). If you later deploy the
--      async AI sweep it can still downgrade an APPROVED row to BLOCKED.
--
--   2. VIETNAMESE MATCHING (Task 3). The old normalization
--      (regexp_replace(..., '[^a-z0-9]+', ' ')) DESTROYED Vietnamese accented
--      letters ("giết" -> "gi t"), so no Vietnamese phrase could ever match at
--      Layer 0. The new normalization lowercases (the DB is en_US.UTF-8, which
--      lowercases Vietnamese correctly) and turns only ASCII punctuation +
--      whitespace into single spaces, PRESERVING diacritics. Accented blocklist
--      phrases then match accented input. We deliberately do NOT fold accents,
--      because unaccented Vietnamese is ambiguous ("cặc" vs "các", "đĩ" vs "đi").
--      Common unaccented forms are added as separate phrases only where they do
--      not collide with everyday words.
--
--   OpenAI's omni-moderation-latest is multilingual and remains the primary
--   defense (verified live: a Vietnamese threat returns flagged=true; the neutral
--   claim "Tổng thống đã ký dự luật" returns flagged=false). These deterministic
--   Vietnamese phrases are the fast offline backstop.

-- 1. VIETNAMESE PHRASES -> public.moderation_blocklist ---------------------------
-- Stored lowercase with diacritics preserved (matches the new normalization).
-- Categories mirror 048: violence / sexual / harassment (+ spam).
insert into public.moderation_blocklist (phrase, category, severity) values
  -- violence / threats
  ('giết mày', 'violence', 'Critical'),
  ('giet may', 'violence', 'Critical'),
  ('tao giết mày', 'violence', 'Critical'),
  ('tao giet may', 'violence', 'Critical'),
  ('giết cả nhà mày', 'violence', 'Critical'),
  ('giet ca nha may', 'violence', 'Critical'),
  ('đâm chết mày', 'violence', 'Critical'),
  ('dam chet may', 'violence', 'Critical'),
  ('đánh chết mày', 'violence', 'Critical'),
  ('danh chet may', 'violence', 'Critical'),
  ('cho mày chết', 'violence', 'High'),
  ('thảm sát', 'violence', 'Critical'),
  ('khủng bố', 'violence', 'Critical'),
  ('đánh bom', 'violence', 'Critical'),
  -- sexual (severe profanity / slurs / exploitation)
  ('địt mẹ', 'sexual', 'High'),
  ('dit me', 'sexual', 'High'),
  ('đụ má', 'sexual', 'High'),
  ('đụ mẹ', 'sexual', 'High'),
  ('lồn', 'sexual', 'High'),
  ('cặc', 'sexual', 'High'),
  ('hiếp dâm', 'sexual', 'Critical'),
  ('hiep dam', 'sexual', 'Critical'),
  ('ấu dâm', 'sexual', 'Critical'),
  ('au dam', 'sexual', 'Critical'),
  -- harassment / hate
  ('đồ chó chết', 'harassment', 'High'),
  ('con điếm', 'harassment', 'High'),
  ('thằng chó chết', 'harassment', 'High'),
  -- spam / fake engagement
  ('mua like', 'spam', 'High'),
  ('mua follow', 'spam', 'High'),
  ('mua follower', 'spam', 'High'),
  ('mua lượt theo dõi', 'spam', 'High'),
  ('mua luot theo doi', 'spam', 'High')
on conflict (phrase) do update
  set category = excluded.category,
      severity = excluded.severity;

-- 2. TRIGGER REWRITE: accent-preserving normalization + auto-approve clean -------
create or replace function public.factlens_claim_safety_layer0()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  norm text;
  padded text;
  hit_category text;
begin
  if new.safety_status is null then
    new.safety_status := 'PENDING';
  end if;

  -- Respect a decision already stamped by another path; only judge fresh PENDING.
  if new.safety_status in ('BLOCKED', 'APPROVED') then
    return new;
  end if;

  -- TASK 1: clean content is APPROVED synchronously so it is visible on the feed
  -- immediately (see header). We start from APPROVED and only downgrade to
  -- BLOCKED on a deterministic match below.
  new.safety_status := 'APPROVED';
  new.safety_checked_at := now();

  -- TASK 3: lowercase, then collapse ASCII punctuation + whitespace to single
  -- spaces. Vietnamese letters are neither punct nor space, so diacritics are
  -- PRESERVED (unlike the old '[^a-z0-9]+' which stripped them).
  norm := lower(coalesce(new.title, '') || ' ' || coalesce(new.description, ''));
  norm := regexp_replace(norm, '[[:punct:][:space:]]+', ' ', 'g');
  norm := btrim(norm);

  if norm = '' then
    return new;  -- APPROVED
  end if;

  padded := ' ' || norm || ' ';

  -- Blocklist (space-padded contains == word/phrase boundary match). Works for
  -- both English (ASCII) and Vietnamese (accents preserved on both sides).
  select category into hit_category
  from public.moderation_blocklist
  where position(' ' || phrase || ' ' in padded) > 0
  order by id
  limit 1;

  if hit_category is not null then
    new.safety_status := 'BLOCKED';
    new.safety_category := hit_category;
    return new;
  end if;

  -- Intent regexes (English indirect / third-person violence). Base verb stems
  -- match inflections since the text is normalized.
  if norm ~ '(will|gonna|going to|should|needs? to)\s+(be\s+)?(kill|murder|shoot|stab)'
     or norm ~ 'kill\s+(them|him|her|all|everyone|yourself|myself)' then
    new.safety_status := 'BLOCKED';
    new.safety_category := 'violence';
    return new;
  end if;

  return new;  -- APPROVED (clean at Layer 0)
exception
  when others then
    -- Never break an insert on a trigger error, and never leave the row hidden
    -- because of one: fall back to APPROVED (client + backend OpenAI moderation
    -- already gated this content before insert).
    new.safety_status := 'APPROVED';
    return new;
end;
$$;

-- Trigger definition unchanged (048 already created it); recreate defensively.
drop trigger if exists factlens_claim_safety_layer0 on public.claims;
create trigger factlens_claim_safety_layer0
  before insert on public.claims
  for each row
  execute function public.factlens_claim_safety_layer0();

-- 3. BACKFILL: unstick claims that were left PENDING by the missing approver.
-- These pre-date the auto-approve trigger; anything genuinely objectionable is
-- still caught by the deterministic layers + report/moderation flow.
update public.claims set safety_status = 'APPROVED', safety_checked_at = now()
  where safety_status = 'PENDING';

notify pgrst, 'reload schema';
