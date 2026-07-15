-- 049 — Reversible soft delete for claims (FK-safe admin delete)
--
-- ⚠️ ALREADY APPLIED to production (islcxqkevxxopatqvlqz) via MCP apply_migration
--    on 2026-07-14. Safe to re-run in the Supabase SQL editor: every statement
--    is idempotent (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
--
-- WHY:
--   The admin "Delete claim" action (POST /admin/claims/delete) used to run a
--   hard `DELETE FROM public.claims`. That intermittently failed with
--   "admin action could not be completed" because several child tables reference
--   claims with a NO ACTION delete rule and BLOCK the delete when a row exists:
--       saved_claims.claim_id, moderation_appeals.claim_id,
--       user_blocks.source_claim_id, claims.canonical_claim_id (self-ref)
--   Claims that nothing referenced deleted fine; anything a user had saved,
--   appealed, blocked-through, or that was another claim's canonical duplicate
--   raised a ForeignKeyViolation. Verifact's model is append-only, so the fix is
--   a soft delete: the endpoint now UPDATEs the row instead of deleting it, which
--   can never hit a foreign key and is reversible.
--
-- VISIBILITY:
--   These columns do NOT need their own RLS policy. The delete endpoint also sets
--   is_hidden = true, and the EXISTING restrictive SELECT policy from migration
--   040 — "Hide hidden claims from public" (is_hidden = false OR admin OR author)
--   — already removes the row from every feed / search / topic for normal users.
--   is_deleted is the semantic marker (deleted vs. merely hidden) and the anchor
--   for a clean, non-destructive Restore (it never overwrites the real status).

alter table public.claims
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists deleted_reason text;

create index if not exists idx_claims_is_deleted on public.claims(is_deleted);

-- Restrictive SELECT policy: soft-deleted claims disappear for EVERYONE except
-- admins — including the author's own "my claims" / saved / single-claim views.
-- (The existing "Hide hidden claims from public" policy exempts the author,
-- which is right for a plain moderation hide but not for a delete.) Restrictive
-- policies AND with the others; non-deleted rows (is_deleted=false default) are
-- unaffected. All app reads (feed, search, topics, saved, my-claims, single
-- claim) go through the user's JWT, so this one policy covers every surface.
drop policy if exists "Hide deleted claims" on public.claims;
create policy "Hide deleted claims"
  on public.claims as restrictive for select
  using (
    is_deleted = false
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- Backfill: a claim was left status='DELETED' with is_hidden=false by an earlier
-- delete attempt, so it is currently soft-deleted in name only and still visible.
-- Mark it deleted AND hidden so the live RLS gate actually removes it.
update public.claims
set is_deleted = true,
    is_hidden = true,
    hidden = true,
    deleted_at = coalesce(deleted_at, now()),
    deleted_reason = coalesce(deleted_reason, 'Backfill: legacy admin delete before soft-delete fix')
where status = 'DELETED' and is_deleted = false;

notify pgrst, 'reload schema';
