-- Add system and placeholder usernames to reserved_people.
-- Run this in Supabase SQL Editor if the full reserved identity import was already run.

begin;

create temp table import_reserved_system_usernames (
  display_name text,
  normalized_key text primary key,
  category text,
  source_import text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
) on commit drop;

insert into import_reserved_system_usernames (display_name, normalized_key, category, source_import)
values
('verifact', 'verifact', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('placeholder', 'placeholder', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('coming soon', 'comingsoon', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('todo', 'todo', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('lorem', 'lorem', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('lorem ipsum', 'loremipsum', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('demo', 'demo', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('test user', 'testuser', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('randomuser', 'randomuser', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('guest', 'guest', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('anonymous', 'anonymous', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('admin', 'admin', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('administrator', 'administrator', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('system', 'system', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('root', 'root', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('support', 'support', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('help', 'help', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('staff', 'staff', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('moderator', 'moderator', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('null', 'null', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('undefined', 'undefined', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('nan', 'nan', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('test', 'test', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('testing', 'testing', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('tester', 'tester', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('asdf', 'asdf', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('qwerty', 'qwerty', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('user', 'user', 'System Reserved Usernames', '032_reserved_system_usernames.sql'),
('username', 'username', 'System Reserved Usernames', '032_reserved_system_usernames.sql');

do $$
declare
  insert_cols text[] := array['display_name', 'normalized_key', 'category'];
  select_exprs text[] := array['display_name', 'normalized_key', 'category'];
  update_exprs text[] := array[
    'display_name = excluded.display_name',
    'category = excluded.category'
  ];
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reserved_people' and column_name = 'active'
  ) then
    insert_cols := array_append(insert_cols, 'active');
    select_exprs := array_append(select_exprs, 'active');
    update_exprs := array_append(update_exprs, 'active = excluded.active');
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reserved_people' and column_name = 'source_import'
  ) then
    insert_cols := array_append(insert_cols, 'source_import');
    select_exprs := array_append(select_exprs, 'source_import');
    update_exprs := array_append(update_exprs, 'source_import = excluded.source_import');
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reserved_people' and column_name = 'created_at'
  ) then
    insert_cols := array_append(insert_cols, 'created_at');
    select_exprs := array_append(select_exprs, 'created_at');
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reserved_people' and column_name = 'updated_at'
  ) then
    insert_cols := array_append(insert_cols, 'updated_at');
    select_exprs := array_append(select_exprs, 'updated_at');
    update_exprs := array_append(update_exprs, 'updated_at = excluded.updated_at');
  end if;

  execute format(
    'insert into public.%I (%s) select %s from %I on conflict (normalized_key) do update set %s',
    'reserved_people',
    array_to_string(array(select quote_ident(column_name) from unnest(insert_cols) as column_name), ', '),
    array_to_string(select_exprs, ', '),
    'import_reserved_system_usernames',
    array_to_string(update_exprs, ', ')
  );
end $$;

notify pgrst, 'reload schema';

commit;
