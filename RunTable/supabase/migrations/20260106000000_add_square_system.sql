-- Square System Tables

-- 1. Channels
CREATE TABLE IF NOT EXISTS public.channels (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    category text NOT NULL DEFAULT '常规', -- '常规', '资源', '官方'
    description text,
    is_private boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 2. Posts
CREATE TABLE IF NOT EXISTS public.posts (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text, -- Optional title
    content text NOT NULL,
    tags text[], -- Array of tags
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 3. Post Likes
CREATE TABLE IF NOT EXISTS public.post_likes (
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (post_id, user_id)
);

-- 4. Post Comments
CREATE TABLE IF NOT EXISTS public.post_comments (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- RLS Policies
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- Channels
CREATE POLICY "Channels are viewable by everyone" ON public.channels FOR SELECT USING (true);

-- Posts
CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- Likes
CREATE POLICY "Likes are viewable by everyone" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert likes" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

-- Comments
CREATE POLICY "Comments are viewable by everyone" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create comments" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.post_comments FOR DELETE USING (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.channels, public.posts, public.post_likes, public.post_comments;

-- Seed default channels (Using DO block to avoid duplicates if re-run)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.channels WHERE name = '闲聊大厅') THEN
        INSERT INTO public.channels (name, category, description) VALUES
        ('闲聊大厅', '常规', '自由交流的地方'),
        ('跑团招募', '常规', '寻找你的队友'),
        ('模组分享', '资源', '分享你的原创或翻译模组'),
        ('战报存放', '资源', '记录你的精彩团战'),
        ('建议反馈', '官方', '向开发者反馈问题');
    END IF;
END $$;
