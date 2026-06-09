-- Rebrand stored public labels from FactLens to Verifact.
-- Keep existing factlens_* SQL function and trigger names for compatibility.

do $$
begin
  if to_regclass('public.profiles') is not null then
    update public.profiles
    set rank_title = 'Verifact Guardian'
    where rank_title = 'FactLens Guardian';

    update public.profiles
    set highest_rank_achieved = 'Verifact Guardian'
    where highest_rank_achieved = 'FactLens Guardian';
  end if;

  if to_regclass('public.reputation_events') is not null then
    update public.reputation_events
    set
      rank_before = case when rank_before = 'FactLens Guardian' then 'Verifact Guardian' else rank_before end,
      rank_after = case when rank_after = 'FactLens Guardian' then 'Verifact Guardian' else rank_after end,
      reason = replace(reason, 'FactLens', 'Verifact')
    where
      rank_before = 'FactLens Guardian'
      or rank_after = 'FactLens Guardian'
      or reason like '%FactLens%';
  end if;

  if to_regclass('public.reputation_notification_events') is not null then
    update public.reputation_notification_events
    set
      title = replace(title, 'FactLens', 'Verifact'),
      body = replace(body, 'FactLens', 'Verifact'),
      metadata = replace(metadata::text, 'FactLens', 'Verifact')::jsonb
    where
      title like '%FactLens%'
      or body like '%FactLens%'
      or metadata::text like '%FactLens%';
  end if;
end $$;
