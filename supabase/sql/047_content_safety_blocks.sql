-- CONTENT SAFETY (NEW, additive) — moderation visibility for blocked submissions.
--
-- The content-safety gate (backend /api/claims/safety-check ->
-- services/content_safety.py) blocks objectionable claims BEFORE they are
-- inserted. This table records those blocked attempts so moderators can see
-- what the filter is catching. Additive only; nothing else references it.
--
-- No FK on user_id (fail-soft: a logging insert must never fail the request).
-- RLS enabled with NO policies: the backend writes with the service role
-- (bypasses RLS); regular clients get no access to these records.

create table if not exists public.content_safety_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  title_snippet text,
  category text,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_content_safety_blocks_created
on public.content_safety_blocks (created_at desc);

alter table public.content_safety_blocks enable row level security;

notify pgrst, 'reload schema';
