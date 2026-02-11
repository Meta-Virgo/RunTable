-- Fix RLS policy to allow KP to remove characters (set room_id to NULL)
-- ERROR: new row violates row-level security policy for table "characters"
-- Reason: The default WITH CHECK policy (inherited from USING) fails when room_id becomes NULL because the KP is no longer linked to the character via the room.

DROP POLICY IF EXISTS "Owner or KP can update characters" ON public.characters;

CREATE POLICY "Owner or KP can update characters" ON public.characters FOR UPDATE USING ( 
    auth.uid() = user_id OR 
    auth.uid() IN (SELECT kp_id FROM public.rooms WHERE id = room_id) 
) WITH CHECK (
    auth.uid() = user_id OR 
    auth.uid() IN (SELECT kp_id FROM public.rooms WHERE id = room_id) OR
    room_id IS NULL
);
