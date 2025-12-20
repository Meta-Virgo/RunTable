-- Add avatar_url to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Add avatar_url to characters
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS avatar_url text;

-- Create avatars bucket if not exists (This usually requires a separate script or manual setup in Supabase Dashboard, 
-- but we can try to insert into storage.buckets if the user has permissions)
-- Note: managing storage buckets via SQL is possible if the extension is enabled and permissions allow.
-- Otherwise, the user must create 'avatars' bucket in the dashboard.

-- Attempt to create the bucket (standard Supabase/PostgreSQL storage schema)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Set up storage policies for avatars
-- 1. Public Access
create policy "Avatar images are publicly accessible."
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- 2. Authenticated Upload
create policy "Authenticated users can upload avatars"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'avatars' );

-- 3. Update (Optional, usually we just overwrite or upload new)
create policy "Users can update their own avatars"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'avatars' AND auth.uid() = owner );
