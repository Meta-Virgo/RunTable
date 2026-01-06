-- Add image_url to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS image_url text;
