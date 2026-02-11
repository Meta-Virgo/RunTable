-- Fix room update policy to ensure KP can update room details (including bg_music_url)
DROP POLICY IF EXISTS "KP can update rooms" ON public.rooms;

CREATE POLICY "KP can update rooms" ON public.rooms 
FOR UPDATE 
USING (auth.uid() = kp_id);
