-- 1. Create comment_likes table
CREATE TABLE IF NOT EXISTS public.comment_likes (
    comment_id uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (comment_id, user_id)
);

-- 2. Add quote_id to post_comments
ALTER TABLE public.post_comments 
ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.post_comments(id) ON DELETE SET NULL;

-- 3. RLS Policies for comment_likes
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comment likes are viewable by everyone" 
ON public.comment_likes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert comment likes" 
ON public.comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comment likes" 
ON public.comment_likes FOR DELETE USING (auth.uid() = user_id);

-- 4. Add to Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_likes;
