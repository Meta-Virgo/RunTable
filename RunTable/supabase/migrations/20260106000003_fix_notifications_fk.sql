-- Fix notifications actor_id foreign key to reference profiles instead of auth.users
-- This allows PostgREST to join notifications with profiles using actor:actor_id(...)

BEGIN;

-- Drop existing FK if it exists (it references auth.users)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_actor_id_fkey;

-- Add new FK referencing public.profiles
-- Note: profiles.id is a FK to auth.users.id, so the data integrity is maintained.
ALTER TABLE public.notifications 
    ADD CONSTRAINT notifications_actor_id_fkey 
    FOREIGN KEY (actor_id) 
    REFERENCES public.profiles(id) 
    ON DELETE CASCADE;

COMMIT;
