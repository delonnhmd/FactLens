-- ADMIN BADGES (Task 2)
--
-- ⚠️ RUN THIS MANUALLY IN THE SUPABASE SQL EDITOR (required migration).
--    Takes effect immediately — no app deploy needed. Idempotent (safe to re-run).
--
-- Adds an "Admin" badge to profiles.badge_list for the three admin accounts,
-- matched by email via auth.users. badge_list is a jsonb array of
-- {id, name, earned_at} objects (see utils/reputation.ts parseBadgeList), and
-- the app renders it generically on the profile header + public profile, plus a
-- red "Admin" pill on the claim author row (ClaimCard). The frontend gives any
-- badge with id='admin' (or name 'Admin') a distinct red style.
--
-- Idempotent: the badge is appended only if the profile has no admin badge yet,
-- so re-running never creates duplicates. It does NOT change is_admin (already
-- true for these accounts) — it only makes the role visible.

update public.profiles p
set badge_list = coalesce(p.badge_list, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('id', 'admin', 'name', 'Admin', 'earned_at', to_jsonb(now()))
    )
from auth.users u
where u.id = p.id
  and lower(u.email) in (
    'md.noithat@gmail.com',
    'delonnhmd@gmail.com',
    'minhducmediallc@gmail.com'
  )
  and not exists (
    select 1
    from jsonb_array_elements(coalesce(p.badge_list, '[]'::jsonb)) as existing(badge)
    where existing.badge->>'id' = 'admin'
       or lower(existing.badge->>'name') = 'admin'
  );

-- Verify (optional): shows the three accounts and their badge_list after the run.
-- select u.email, p.username, p.is_admin, p.badge_list
-- from public.profiles p
-- join auth.users u on u.id = p.id
-- where lower(u.email) in ('md.noithat@gmail.com','delonnhmd@gmail.com','minhducmediallc@gmail.com');

notify pgrst, 'reload schema';
