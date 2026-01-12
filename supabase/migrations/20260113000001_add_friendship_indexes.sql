
-- Add indexes for friendships table to optimize queries
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON public.friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON public.friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON public.friendships(status);

-- Also ensure profiles have necessary indexes (though likely they do)
-- idx_profiles_user_code and idx_profiles_nickname were added in 20251227000000_add_friend_system.sql
