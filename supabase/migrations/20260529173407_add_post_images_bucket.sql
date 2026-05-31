-- Store square post images in Supabase Storage instead of embedding base64 in rows.
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

drop policy if exists "Post images are publicly accessible" on storage.objects;
create policy "Post images are publicly accessible"
  on storage.objects
  for select
  using (bucket_id = 'post-images');

drop policy if exists "Users can upload post images" on storage.objects;
create policy "Users can upload post images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can update own post images" on storage.objects;
create policy "Users can update own post images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'post-images'
    and owner = (select auth.uid())
  )
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete own post images" on storage.objects;
create policy "Users can delete own post images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'post-images'
    and owner = (select auth.uid())
  );

notify pgrst, 'reload schema';
