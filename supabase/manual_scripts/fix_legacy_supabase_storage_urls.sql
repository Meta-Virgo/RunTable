-- Diagnostic and cleanup script for legacy Supabase Storage URLs
-- Old project host: otvlvdjjtuhobeslcvwr.supabase.co
-- Active project host: ejuwvqjaserearyvohxw.supabase.co
--
-- Step 1: Run the SELECT queries below in Supabase SQL Editor to inspect affected rows.

SELECT 'profiles.avatar_url' AS target, id, nickname, avatar_url AS url
FROM public.profiles
WHERE avatar_url LIKE '%otvlvdjjtuhobeslcvwr.supabase.co%';

SELECT 'characters.avatar_url' AS target, id, name, avatar_url AS url
FROM public.characters
WHERE avatar_url LIKE '%otvlvdjjtuhobeslcvwr.supabase.co%';

SELECT 'module_templates.cover_image_url' AS target, id, title, cover_image_url AS url
FROM public.module_templates
WHERE cover_image_url LIKE '%otvlvdjjtuhobeslcvwr.supabase.co%';

SELECT 'rooms.cover_image_url' AS target, id, name, cover_image_url AS url
FROM public.rooms
WHERE cover_image_url LIKE '%otvlvdjjtuhobeslcvwr.supabase.co%';

SELECT 'posts.image_url' AS target, id, title, image_url AS url
FROM public.posts
WHERE image_url LIKE '%otvlvdjjtuhobeslcvwr.supabase.co%';

-- Step 2:
-- Option A (if the same object paths already exist in the new Storage buckets):
-- Rewrite the legacy host to the active Supabase host.
--
-- BEGIN;
-- UPDATE public.profiles
-- SET avatar_url = replace(avatar_url, 'otvlvdjjtuhobeslcvwr.supabase.co', 'ejuwvqjaserearyvohxw.supabase.co')
-- WHERE avatar_url LIKE '%otvlvdjjtuhobeslcvwr.supabase.co%';
--
-- UPDATE public.characters
-- SET avatar_url = replace(avatar_url, 'otvlvdjjtuhobeslcvwr.supabase.co', 'ejuwvqjaserearyvohxw.supabase.co')
-- WHERE avatar_url LIKE '%otvlvdjjtuhobeslcvwr.supabase.co%';
--
-- UPDATE public.module_templates
-- SET cover_image_url = replace(cover_image_url, 'otvlvdjjtuhobeslcvwr.supabase.co', 'ejuwvqjaserearyvohxw.supabase.co')
-- WHERE cover_image_url LIKE '%otvlvdjjtuhobeslcvwr.supabase.co%';
--
-- UPDATE public.rooms
-- SET cover_image_url = replace(cover_image_url, 'otvlvdjjtuhobeslcvwr.supabase.co', 'ejuwvqjaserearyvohxw.supabase.co')
-- WHERE cover_image_url LIKE '%otvlvdjjtuhobeslcvwr.supabase.co%';
--
-- UPDATE public.posts
-- SET image_url = replace(image_url, 'otvlvdjjtuhobeslcvwr.supabase.co', 'ejuwvqjaserearyvohxw.supabase.co')
-- WHERE image_url LIKE '%otvlvdjjtuhobeslcvwr.supabase.co%';
-- COMMIT;
--
-- Option B (if the files were NOT copied to the new Storage buckets):
-- Clear the broken URLs so the UI falls back cleanly to default avatars/covers instead of broken image icons.
--
-- BEGIN;
-- UPDATE public.profiles SET avatar_url = NULL WHERE avatar_url LIKE '%otvlvdjjtuhobeslcvwr.supabase.co%';
-- UPDATE public.characters SET avatar_url = NULL WHERE avatar_url LIKE '%otvlvdjjtuhobeslcvwr.supabase.co%';
-- UPDATE public.module_templates SET cover_image_url = NULL WHERE cover_image_url LIKE '%otvlvdjjtuhobeslcvwr.supabase.co%';
-- UPDATE public.rooms SET cover_image_url = NULL WHERE cover_image_url LIKE '%otvlvdjjtuhobeslcvwr.supabase.co%';
-- UPDATE public.posts SET image_url = NULL WHERE image_url LIKE '%otvlvdjjtuhobeslcvwr.supabase.co%';
-- COMMIT;
