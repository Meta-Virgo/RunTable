-- Add avatar_url to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Add avatar_url to characters
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS avatar_url text;

-- Create avatars bucket if not exists
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Set up storage policies for avatars

-- 1. Public Access
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
create policy "Avatar images are publicly accessible."
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- 2. Authenticated Upload
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
create policy "Authenticated users can upload avatars"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'avatars' );

-- 3. Update
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
create policy "Users can update their own avatars"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'avatars' AND auth.uid() = owner );
