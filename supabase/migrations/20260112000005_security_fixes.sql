-- Fix RLS for game history tables
-- The linter detected these were public but RLS was not enabled
ALTER TABLE public.game_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_history_participants ENABLE ROW LEVEL SECURITY;

-- Ensure read-only access for everyone (since these are history records)
-- We drop first to avoid "policy already exists" errors if re-running
DROP POLICY IF EXISTS "Game histories are viewable by everyone" ON public.game_histories;
CREATE POLICY "Game histories are viewable by everyone" ON public.game_histories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Game participants are viewable by everyone" ON public.game_history_participants;
CREATE POLICY "Game participants are viewable by everyone" ON public.game_history_participants FOR SELECT USING (true);


-- Fix Function Search Paths (Security Best Practice: CVE-2018-1058 protection)
-- Explicitly setting search_path prevents malicious users from hijacking function calls
ALTER FUNCTION public.claim_experience(text) SET search_path = public;
ALTER FUNCTION public.handle_heartbeat() SET search_path = public;
ALTER FUNCTION public.update_room_activity() SET search_path = public;
ALTER FUNCTION public.delete_old_system_messages() SET search_path = public;


-- Fix Permissive Notifications Policy
-- The original policy "WITH CHECK (true)" allowed any authenticated user to insert ANY notification
-- We restrict it so users can only insert notifications where they are the 'actor'
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;

CREATE POLICY "Authenticated users can create notifications" 
ON public.notifications 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = actor_id);
