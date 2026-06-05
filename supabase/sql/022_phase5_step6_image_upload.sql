-- PHASE 5 STEP 6
-- Optimized image upload fields and storage buckets.

alter table public.claims
add column if not exists image_url text,
add column if not exists image_path text,
add column if not exists thumbnail_url text;

alter table public.evidence
add column if not exists image_url text,
add column if not exists image_path text,
add column if not exists thumbnail_url text;

alter table public.profiles
add column if not exists avatar_url text,
add column if not exists avatar_path text;

create index if not exists idx_claims_image_url
on public.claims (image_url)
where image_url is not null;

create index if not exists idx_profiles_avatar_url
on public.profiles (avatar_url)
where avatar_url is not null;

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('claim-images', 'claim-images', true, 5242880),
  ('evidence-images', 'evidence-images', true, 5242880),
  ('profile-avatars', 'profile-avatars', true, 3145728)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can upload their own claim images'
  ) then
    create policy "Users can upload their own claim images"
    on storage.objects for insert
    with check (
      bucket_id = 'claim-images'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Anyone can view claim images'
  ) then
    create policy "Anyone can view claim images"
    on storage.objects for select
    using (bucket_id = 'claim-images');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can delete their own claim images'
  ) then
    create policy "Users can delete their own claim images"
    on storage.objects for delete
    using (
      bucket_id = 'claim-images'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can upload their own evidence images'
  ) then
    create policy "Users can upload their own evidence images"
    on storage.objects for insert
    with check (
      bucket_id = 'evidence-images'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Anyone can view evidence images'
  ) then
    create policy "Anyone can view evidence images"
    on storage.objects for select
    using (bucket_id = 'evidence-images');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can delete their own evidence images'
  ) then
    create policy "Users can delete their own evidence images"
    on storage.objects for delete
    using (
      bucket_id = 'evidence-images'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can upload their own avatar'
  ) then
    create policy "Users can upload their own avatar"
    on storage.objects for insert
    with check (
      bucket_id = 'profile-avatars'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Anyone can view avatars'
  ) then
    create policy "Anyone can view avatars"
    on storage.objects for select
    using (bucket_id = 'profile-avatars');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can update their own avatar'
  ) then
    create policy "Users can update their own avatar"
    on storage.objects for update
    using (
      bucket_id = 'profile-avatars'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can delete their own avatar'
  ) then
    create policy "Users can delete their own avatar"
    on storage.objects for delete
    using (
      bucket_id = 'profile-avatars'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  end if;
end $$;

notify pgrst, 'reload schema';
