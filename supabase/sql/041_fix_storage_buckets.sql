-- FIX: AVATAR UPLOAD FAILS ("Could not upload image. Please try again.")
--
-- ⚠️ RUN THIS MANUALLY IN THE SUPABASE SQL EDITOR (required migration).
--    Takes effect immediately — no app deploy needed.
--
-- DIAGNOSIS (verified against production storage API on 2026-07-04):
--   - GET /storage/v1/bucket returns [] — production has NO storage buckets
--     at all. The bucket insert + policies from 022_phase5_step6_image_upload
--     never ran there (same migration drift as 039).
--   - supabase.storage.from('profile-avatars').upload(...) therefore fails
--     with "Bucket not found", which services/imageUploadService.ts maps to
--     the generic "Could not upload image. Please try again."
--   - This also breaks claim-images and evidence-images uploads, so all
--     three buckets are (re)created here.
--   - NOT the cause: the native file read (fetch(uri).arrayBuffer() of the
--     expo-image-manipulator output) and RLS were never reached; the app
--     already downscales to 1280px JPEG q0.75, far under the 3MB limit.
--
-- Idempotent — identical definitions to 022, safe to re-run.

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

  -- upsert:true on the avatar upload needs UPDATE as well as INSERT.
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
