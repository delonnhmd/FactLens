-- PHASE 5 STEP 2
-- Launch-readiness report targets and basic admin review fields.

alter table public.reports
add column if not exists target_type text default 'CLAIM',
add column if not exists evidence_id uuid references public.evidence(id) on delete cascade,
add column if not exists profile_id uuid references public.profiles(id) on delete cascade,
add column if not exists status text default 'OPEN',
add column if not exists resolved_at timestamptz,
add column if not exists resolved_by uuid references public.profiles(id) on delete set null,
add column if not exists admin_note text;

alter table public.reports
alter column claim_id drop not null;

update public.reports
set target_type = 'CLAIM'
where target_type is null;

alter table public.reports
drop constraint if exists reports_reason_check;

alter table public.reports
add constraint reports_reason_check
check (
  reason in (
    'SPAM',
    'FAKE_SOURCE',
    'DUPLICATE_CLAIM',
    'HARMFUL_CONTENT',
    'MISLEADING_TITLE',
    'HARASSMENT_OR_ABUSE',
    'MISINFORMATION_ABUSE',
    'EXPLICIT_CONTENT',
    'MALICIOUS_EVIDENCE',
    'OTHER'
  )
);

alter table public.reports
drop constraint if exists reports_target_type_check;

alter table public.reports
add constraint reports_target_type_check
check (target_type in ('CLAIM', 'EVIDENCE', 'PROFILE'));

alter table public.reports
drop constraint if exists reports_status_check;

alter table public.reports
add constraint reports_status_check
check (status in ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'));

alter table public.reports
drop constraint if exists reports_one_target_check;

alter table public.reports
add constraint reports_one_target_check
check (
  (target_type = 'CLAIM' and claim_id is not null and evidence_id is null and profile_id is null)
  or
  (target_type = 'EVIDENCE' and evidence_id is not null and claim_id is null and profile_id is null)
  or
  (target_type = 'PROFILE' and profile_id is not null and claim_id is null and evidence_id is null)
);

alter table public.reports
drop constraint if exists reports_claim_id_user_id_key;

create unique index if not exists reports_unique_claim_user
on public.reports (claim_id, user_id)
where target_type = 'CLAIM' and claim_id is not null;

create unique index if not exists reports_unique_evidence_user
on public.reports (evidence_id, user_id)
where target_type = 'EVIDENCE' and evidence_id is not null;

create unique index if not exists reports_unique_profile_user
on public.reports (profile_id, user_id)
where target_type = 'PROFILE' and profile_id is not null;

create index if not exists reports_target_status_created_idx
on public.reports (target_type, status, created_at desc);

create index if not exists reports_evidence_id_idx
on public.reports (evidence_id);

create index if not exists reports_profile_id_idx
on public.reports (profile_id);

notify pgrst, 'reload schema';
