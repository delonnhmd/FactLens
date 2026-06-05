-- PHASE 5 STEP 3
-- Minimal moderation queue compatibility columns and content visibility flags.

alter table public.reports
add column if not exists reporter_user_id uuid references public.profiles(id) on delete set null,
add column if not exists target_id uuid,
add column if not exists details text;

update public.reports
set
  reporter_user_id = coalesce(reporter_user_id, user_id),
  target_id = coalesce(target_id, claim_id, evidence_id, profile_id),
  details = coalesce(details, note)
where reporter_user_id is null
  or target_id is null
  or details is null;

create index if not exists idx_reports_status
on public.reports (status);

create index if not exists idx_reports_created
on public.reports (created_at desc);

create index if not exists idx_reports_target
on public.reports (target_type, target_id);

alter table public.claims
add column if not exists hidden boolean default false,
add column if not exists hidden_reason text,
add column if not exists hidden_at timestamptz,
add column if not exists hidden_by uuid references public.profiles(id) on delete set null;

alter table public.evidence
add column if not exists hidden boolean default false,
add column if not exists hidden_reason text,
add column if not exists hidden_at timestamptz,
add column if not exists hidden_by uuid references public.profiles(id) on delete set null;

create or replace function public.set_report_moderation_fields()
returns trigger
language plpgsql
as $$
begin
  new.reporter_user_id = coalesce(new.reporter_user_id, new.user_id);
  new.target_id = coalesce(new.target_id, new.claim_id, new.evidence_id, new.profile_id);
  new.details = coalesce(new.details, new.note);
  return new;
end;
$$;

drop trigger if exists set_report_moderation_fields on public.reports;

create trigger set_report_moderation_fields
before insert or update on public.reports
for each row
execute function public.set_report_moderation_fields();

notify pgrst, 'reload schema';
