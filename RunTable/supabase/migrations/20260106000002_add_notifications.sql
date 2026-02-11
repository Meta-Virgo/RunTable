
-- Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- The recipient
    actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- The person who performed the action
    type text NOT NULL CHECK (type IN ('like', 'comment')),
    post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

-- System/Users can insert notifications (usually triggered by actions)
-- Allowing authenticated users to insert is fine if we handle logic in client, 
-- but ideally this should be a trigger. For simplicity in this project, we'll allow insert.
CREATE POLICY "Authenticated users can create notifications" ON public.notifications
    FOR INSERT TO authenticated WITH CHECK (true);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
