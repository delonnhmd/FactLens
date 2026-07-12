-- CONTENT SAFETY — SERVER-SIDE GATE (enforcement that cannot be bypassed).
--
-- ⚠️ RUN THIS MANUALLY IN THE SUPABASE SQL EDITOR (required migration).
--    Run this BEFORE deploying the backend (webhook/sweep endpoints) and
--    BEFORE `eas update` ships the frontend that renders the author badge.
--    Deploy order: (1) this SQL, (2) set SAFETY_WEBHOOK_SECRET on Render +
--    deploy backend, (3) create the Supabase Database Webhook + Render cron,
--    (4) eas update.
--
-- WHAT THIS DOES
--   claims.safety_status gates public SELECT via a RESTRICTIVE RLS policy, so
--   objectionable content is invisible to everyone except its author and admins
--   REGARDLESS of what the client does. Enforcement is in Postgres, not the app.
--
--   safety_status lifecycle:
--     PENDING  — inserted, awaiting the AI webhook/sweep. Author + admin only.
--     APPROVED — cleared by the AI layers (webhook/sweep). Publicly visible.
--     BLOCKED  — Layer 0 trigger (blocklist/regex) or AI layer flagged it.
--                Author + admin only; author is notified ('claim_blocked').
--
--   Layer 0 (this file): a BEFORE INSERT trigger runs an offline blocklist +
--   intent regexes and stamps BLOCKED instantly, in the same transaction, with
--   no network. It NEVER raises — the insert always succeeds; visibility (RLS)
--   is what enforces. Layers 1+2 (OpenAI moderation + gpt-4.1-mini semantic)
--   run out-of-band via the backend webhook and flip PENDING -> APPROVED/BLOCKED.
--
-- INSPECTION NOTES (additive, safe):
--   - New restrictive SELECT policy ANDs with the existing restrictive policies
--     "Hide claims from blocked authors" (038) and "Hide hidden claims from
--     public" (040); same author_id / profiles.is_admin pattern.
--   - Backfill sets every existing claim to APPROVED, so nothing already in the
--     feed disappears when the policy goes live.
--   - profiles.is_admin exists (024); claims.author_id + claims.created_at exist.

-- 1a. COLUMNS + BACKFILL + INDEX -------------------------------------------------
alter table public.claims
  add column if not exists safety_status text not null default 'PENDING'
    check (safety_status in ('PENDING', 'APPROVED', 'BLOCKED'));
alter table public.claims
  add column if not exists safety_category text,
  add column if not exists safety_checked_at timestamptz;

-- Existing rows were created before the gate — approve them so live feeds are
-- unchanged. Only genuinely new inserts start life as PENDING.
update public.claims set safety_status = 'APPROVED'
  where safety_status = 'PENDING';

create index if not exists idx_claims_safety
  on public.claims (safety_status);

-- RESTRICTIVE SELECT policy: public readers only see APPROVED; authors always
-- see their own (any status) and admins see everything.
drop policy if exists "Only approved claims visible" on public.claims;
create policy "Only approved claims visible"
  on public.claims
  as restrictive
  for select
  using (
    safety_status = 'APPROVED'
    or auth.uid() = author_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- 1b. LAYER 0 — OFFLINE BLOCKLIST TABLE + BEFORE INSERT TRIGGER ------------------
create table if not exists public.moderation_blocklist (
  id bigint generated always as identity primary key,
  phrase text not null unique,
  category text not null,
  severity text not null default 'High'
);

-- Phrases are stored pre-normalized (lowercase, punctuation stripped, single
-- spaces) so the trigger can match them with a simple space-padded contains,
-- giving word-boundary behavior ("cp" does not match "cpu", "execute" does not
-- match "executed"). Mirrors backend/data/moderation_blocklist.json (67 phrases)
-- and utils/moderationBlocklist.ts. Categories: violence / sexual / harassment.
insert into public.moderation_blocklist (phrase, category, severity) values
  ('kill yourself', 'violence', 'Critical'),
  ('go die', 'violence', 'Critical'),
  ('end your life', 'violence', 'Critical'),
  ('hang yourself', 'violence', 'Critical'),
  ('drink bleach', 'violence', 'Critical'),
  ('slit your wrists', 'violence', 'Critical'),
  ('jump off a bridge', 'violence', 'Critical'),
  ('commit suicide', 'violence', 'Critical'),
  ('will kill you', 'violence', 'Critical'),
  ('going to shoot', 'violence', 'Critical'),
  ('stab you', 'violence', 'Critical'),
  ('murder you', 'violence', 'Critical'),
  ('hunt you down', 'violence', 'Critical'),
  ('track your house', 'violence', 'Critical'),
  ('slit your throat', 'violence', 'Critical'),
  ('beat you to death', 'violence', 'Critical'),
  ('bomb', 'violence', 'Critical'),
  ('terrorism', 'violence', 'Critical'),
  ('massacre', 'violence', 'Critical'),
  ('assassinate', 'violence', 'Critical'),
  ('shooting up the', 'violence', 'Critical'),
  ('pipe bomb', 'violence', 'Critical'),
  ('detonate', 'violence', 'Critical'),
  ('blow up', 'violence', 'High'),
  ('decapitate', 'violence', 'High'),
  ('slaughter', 'violence', 'High'),
  ('execute', 'violence', 'High'),
  ('mutilate', 'violence', 'High'),
  ('torture', 'violence', 'High'),
  ('child porn', 'sexual', 'Critical'),
  ('cp', 'sexual', 'Critical'),
  ('pedophile', 'sexual', 'Critical'),
  ('pedo', 'sexual', 'Critical'),
  ('underage sex', 'sexual', 'Critical'),
  ('loli', 'sexual', 'Critical'),
  ('rape', 'sexual', 'Critical'),
  ('molest', 'sexual', 'Critical'),
  ('forced sex', 'sexual', 'Critical'),
  ('non consensual', 'sexual', 'High'),
  ('sexual assault', 'sexual', 'High'),
  ('fuck', 'sexual', 'Medium'),
  ('dick', 'sexual', 'Medium'),
  ('pussy', 'sexual', 'Medium'),
  ('cock', 'sexual', 'Medium'),
  ('tits', 'sexual', 'Medium'),
  ('bitch', 'sexual', 'Medium'),
  ('slut', 'sexual', 'High'),
  ('whore', 'sexual', 'High'),
  ('cum', 'sexual', 'Medium'),
  ('horny', 'sexual', 'Low'),
  ('nigger', 'harassment', 'Critical'),
  ('faggot', 'harassment', 'Critical'),
  ('kike', 'harassment', 'Critical'),
  ('chink', 'harassment', 'Critical'),
  ('spic', 'harassment', 'Critical'),
  ('tranny', 'harassment', 'Critical'),
  ('retard', 'harassment', 'High'),
  ('subhuman', 'harassment', 'High'),
  ('go back to your country', 'harassment', 'High'),
  ('worthless piece of', 'harassment', 'Medium'),
  ('piece of shit', 'harassment', 'Medium'),
  ('motherfucker', 'harassment', 'Medium'),
  ('die slow', 'harassment', 'High'),
  ('waste of space', 'harassment', 'Medium'),
  ('hope you get cancer', 'harassment', 'High'),
  ('kill your family', 'harassment', 'Critical'),
  ('trash', 'harassment', 'Low')
on conflict (phrase) do update
  set category = excluded.category,
      severity = excluded.severity;

-- Trigger function: normalize title+description, then BLOCK on any blocklist
-- phrase or intent regex. Leaves PENDING otherwise for the AI webhook. Wrapped
-- so it can NEVER raise — a failure here must not stop a legitimate insert.
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
  -- Respect a decision already stamped by another path; only judge fresh PENDING.
  if new.safety_status is null then
    new.safety_status := 'PENDING';
  end if;
  if new.safety_status in ('BLOCKED', 'APPROVED') then
    return new;
  end if;

  -- lowercase -> non-alphanumerics to spaces -> collapse -> trim.
  norm := regexp_replace(
    lower(coalesce(new.title, '') || ' ' || coalesce(new.description, '')),
    '[^a-z0-9]+', ' ', 'g'
  );
  norm := btrim(regexp_replace(norm, '\s+', ' ', 'g'));

  if norm = '' then
    return new;
  end if;

  padded := ' ' || norm || ' ';

  -- Blocklist (space-padded contains == word-boundary match).
  select category into hit_category
  from public.moderation_blocklist
  where position(' ' || phrase || ' ' in padded) > 0
  order by id
  limit 1;

  if hit_category is not null then
    new.safety_status := 'BLOCKED';
    new.safety_category := hit_category;
    new.safety_checked_at := now();
    return new;
  end if;

  -- Intent regexes (indirect / third-person violence). Base verb stems match
  -- inflections (kill -> killed) since the text is already normalized.
  if norm ~ '(will|gonna|going to|should|needs? to)\s+(be\s+)?(kill|murder|shoot|stab)'
     or norm ~ 'kill\s+(them|him|her|all|everyone|yourself|myself)' then
    new.safety_status := 'BLOCKED';
    new.safety_category := 'violence';
    new.safety_checked_at := now();
    return new;
  end if;

  return new;  -- clean at Layer 0 — stays PENDING for the AI webhook/sweep.
exception
  when others then
    -- Never block the insert on a trigger error; the row stays PENDING and the
    -- sweep will re-check it.
    return new;
end;
$$;

drop trigger if exists factlens_claim_safety_layer0 on public.claims;
create trigger factlens_claim_safety_layer0
  before insert on public.claims
  for each row
  execute function public.factlens_claim_safety_layer0();

notify pgrst, 'reload schema';
