-- TASK 4 — FIX AVATAR "photo uploaded but profile could not be updated"
--
-- Root cause: production drift. Repo migration 022_phase5_step6_image_upload.sql
-- adds profiles.avatar_path, but it was never applied to production — the column
-- is missing there. The avatar save path is:
--   frontend handleSaveAvatar (app/(tabs)/profile.tsx)
--     -> updateProfile({ avatar_url, avatar_path }) (services/profileService.ts)
--       -> backend PATCH /profile (update_backend_profile in backend/main.py)
-- The backend uses the SERVICE ROLE client (bypasses RLS, and the
-- protect_profile_admin_fields trigger's role='authenticated' guard is a no-op),
-- so RLS/trigger are NOT the failure. The failure is PostgREST rejecting the
-- unknown `avatar_path` column, which the backend turns into a 503 -> the app
-- shows "your profile could not be updated" AFTER storage already succeeded.
--
-- Fix is purely ADDITIVE: add the missing nullable column. Safe to re-run; a
-- no-op where 022 was already applied.

alter table public.profiles
add column if not exists avatar_path text;

notify pgrst, 'reload schema';
