-- Add indexes for foreign keys to improve performance
-- Based on Supabase linter recommendations

-- Characters table
CREATE INDEX IF NOT EXISTS idx_characters_user_id ON public.characters(user_id);

-- Comment Likes table
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON public.comment_likes(user_id);

-- Game Histories table
CREATE INDEX IF NOT EXISTS idx_game_histories_kp_id ON public.game_histories(kp_id);
CREATE INDEX IF NOT EXISTS idx_game_histories_room_id ON public.game_histories(room_id);

-- Game History Participants table
CREATE INDEX IF NOT EXISTS idx_gh_participants_game_history_id ON public.game_history_participants(game_history_id);
CREATE INDEX IF NOT EXISTS idx_gh_participants_user_id ON public.game_history_participants(user_id);

-- Messages table
CREATE INDEX IF NOT EXISTS idx_messages_character_id ON public.messages(character_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);

-- Notifications table
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON public.notifications(actor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_post_id ON public.notifications(post_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- Post Comments table
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_quote_id ON public.post_comments(quote_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON public.post_comments(user_id);

-- Post Likes table
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes(user_id);

-- Posts table
CREATE INDEX IF NOT EXISTS idx_posts_channel_id ON public.posts(channel_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
