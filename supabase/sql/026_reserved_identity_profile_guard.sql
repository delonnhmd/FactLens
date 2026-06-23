-- Phase 1 reserved identity guard for direct Supabase profile writes.

create or replace function public.normalize_identity_key(input text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(coalesce(input, ''), '[[:space:]_.-]+', '', 'g'));
$$;

create or replace function public.identity_table_has_column(target_table_name text, target_column_name text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = target_table_name
      and column_name = target_column_name
  );
$$;

create or replace function public.profile_username_is_reserved(input text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_key text := public.normalize_identity_key(input);
  table_name text;
  alias_column text;
  active_predicate text;
  found_match boolean;
begin
  if normalized_key = '' then
    return false;
  end if;

  foreach table_name in array array['reserved_people', 'reserved_brands']
  loop
    if to_regclass('public.' || table_name) is null then
      continue;
    end if;

    if public.identity_table_has_column(table_name, 'active') then
      active_predicate := 'coalesce(active, true)';
    elsif public.identity_table_has_column(table_name, 'is_active') then
      active_predicate := 'coalesce(is_active, true)';
    else
      active_predicate := 'true';
    end if;

    execute format(
      'select exists (select 1 from public.%I where %s and normalized_key = $1)',
      table_name,
      active_predicate
    )
    into found_match
    using normalized_key;

    if found_match then
      return true;
    end if;

    foreach alias_column in array array['aliases', 'alias_keys', 'normalized_aliases']
    loop
      if not public.identity_table_has_column(table_name, alias_column) then
        continue;
      end if;

      execute format(
        'select exists (
          select 1
          from public.%I
          where %s
            and (
              public.normalize_identity_key(%I::text) = $1
              or exists (
                select 1
                from jsonb_array_elements_text(
                  case
                    when jsonb_typeof(to_jsonb(%I)) = ''array'' then to_jsonb(%I)
                    else ''[]''::jsonb
                  end
                ) as alias_value(value)
                where public.normalize_identity_key(alias_value.value) = $1
              )
            )
        )',
        table_name,
        active_predicate,
        alias_column,
        alias_column,
        alias_column
      )
      into found_match
      using normalized_key;

      if found_match then
        return true;
      end if;
    end loop;
  end loop;

  return false;
end;
$$;

grant execute on function public.normalize_identity_key(text) to anon, authenticated, service_role;
grant execute on function public.profile_username_is_reserved(text) to anon, authenticated, service_role;

create or replace function public.block_reserved_profile_username()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.username is distinct from old.username then
    if public.profile_username_is_reserved(new.username) then
      raise exception using
        message = 'This username is reserved. If you represent this person or organization, please apply for verification.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists block_reserved_profile_username on public.profiles;

create trigger block_reserved_profile_username
before insert or update of username
on public.profiles
for each row
execute function public.block_reserved_profile_username();

notify pgrst, 'reload schema';
