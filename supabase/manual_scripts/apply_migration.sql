-- 1. Add level and experience columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS level INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS experience INT DEFAULT 0;

-- 2. Create daily_activities table
CREATE TABLE IF NOT EXISTS public.daily_activities (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_date DATE DEFAULT CURRENT_DATE,
    online_seconds INT DEFAULT 0,
    login_claimed BOOLEAN DEFAULT FALSE,
    online_30m_claimed BOOLEAN DEFAULT FALSE,
    online_60m_claimed BOOLEAN DEFAULT FALSE,
    online_120m_claimed BOOLEAN DEFAULT FALSE,
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (user_id, activity_date)
);

-- 3. RLS for daily_activities
ALTER TABLE public.daily_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own daily activities" ON public.daily_activities;
CREATE POLICY "Users can view own daily activities" 
ON public.daily_activities FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own daily activities" ON public.daily_activities;
CREATE POLICY "Users can update own daily activities" 
ON public.daily_activities FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own daily activities" ON public.daily_activities;
CREATE POLICY "Users can insert own daily activities" 
ON public.daily_activities FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 4. Heartbeat function
CREATE OR REPLACE FUNCTION public.handle_heartbeat()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    curr_date DATE := CURRENT_DATE;
    user_activity RECORD;
    added_seconds INT := 60; -- Assume called every minute
BEGIN
    -- Check if record exists for today
    SELECT * INTO user_activity 
    FROM public.daily_activities 
    WHERE user_id = auth.uid() AND activity_date = curr_date;

    IF NOT FOUND THEN
        INSERT INTO public.daily_activities (user_id, activity_date, online_seconds, last_heartbeat)
        VALUES (auth.uid(), curr_date, 0, timezone('utc'::text, now()))
        RETURNING * INTO user_activity;
    ELSE
        UPDATE public.daily_activities
        SET online_seconds = online_seconds + added_seconds,
            last_heartbeat = timezone('utc'::text, now())
        WHERE user_id = auth.uid() AND activity_date = curr_date
        RETURNING * INTO user_activity;
    END IF;

    RETURN to_jsonb(user_activity);
END;
$$;

-- 5. Claim experience function
CREATE OR REPLACE FUNCTION public.claim_experience(reward_type TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    curr_date DATE := CURRENT_DATE;
    user_activity RECORD;
    exp_gain INT := 0;
    new_level INT;
    current_exp INT;
    current_level INT;
    exp_needed INT;
BEGIN
    SELECT * INTO user_activity 
    FROM public.daily_activities 
    WHERE user_id = auth.uid() AND activity_date = curr_date;

    IF NOT FOUND THEN
        -- Auto create if missing (e.g. login reward)
        INSERT INTO public.daily_activities (user_id, activity_date)
        VALUES (auth.uid(), curr_date)
        RETURNING * INTO user_activity;
    END IF;

    -- Determine exp gain
    IF reward_type = 'login' THEN
        IF user_activity.login_claimed THEN RAISE EXCEPTION 'Already claimed'; END IF;
        exp_gain := 5; 
        UPDATE public.daily_activities SET login_claimed = TRUE WHERE user_id = auth.uid() AND activity_date = curr_date;
    ELSIF reward_type = '30m' THEN
        IF user_activity.online_30m_claimed THEN RAISE EXCEPTION 'Already claimed'; END IF;
        IF user_activity.online_seconds < 1800 THEN RAISE EXCEPTION 'Not enough online time'; END IF;
        exp_gain := 10;
        UPDATE public.daily_activities SET online_30m_claimed = TRUE WHERE user_id = auth.uid() AND activity_date = curr_date;
    ELSIF reward_type = '60m' THEN
        IF user_activity.online_60m_claimed THEN RAISE EXCEPTION 'Already claimed'; END IF;
        IF user_activity.online_seconds < 3600 THEN RAISE EXCEPTION 'Not enough online time'; END IF;
        exp_gain := 20;
        UPDATE public.daily_activities SET online_60m_claimed = TRUE WHERE user_id = auth.uid() AND activity_date = curr_date;
    ELSIF reward_type = '120m' THEN
        IF user_activity.online_120m_claimed THEN RAISE EXCEPTION 'Already claimed'; END IF;
        IF user_activity.online_seconds < 7200 THEN RAISE EXCEPTION 'Not enough online time'; END IF;
        exp_gain := 30;
        UPDATE public.daily_activities SET online_120m_claimed = TRUE WHERE user_id = auth.uid() AND activity_date = curr_date;
    ELSE
        RAISE EXCEPTION 'Invalid reward type';
    END IF;

    -- Update profile
    SELECT level, experience INTO current_level, current_exp FROM public.profiles WHERE id = auth.uid();
    
    -- Handle nulls
    IF current_level IS NULL THEN current_level := 1; END IF;
    IF current_exp IS NULL THEN current_exp := 0; END IF;

    current_exp := current_exp + exp_gain;
    
    -- Level up logic (Baidu Tieba style)
    LOOP
        exp_needed := CASE current_level
            WHEN 1 THEN 5
            WHEN 2 THEN 15
            WHEN 3 THEN 30
            WHEN 4 THEN 50
            WHEN 5 THEN 100
            WHEN 6 THEN 200
            WHEN 7 THEN 500
            WHEN 8 THEN 1000
            WHEN 9 THEN 2000
            WHEN 10 THEN 3000
            WHEN 11 THEN 6000
            WHEN 12 THEN 10000
            WHEN 13 THEN 18000
            WHEN 14 THEN 30000
            WHEN 15 THEN 60000
            WHEN 16 THEN 100000
            WHEN 17 THEN 300000
            WHEN 18 THEN 500000
            WHEN 19 THEN 800000
            ELSE 999999999
        END;
        
        IF current_exp >= exp_needed AND current_level < 20 THEN
            current_level := current_level + 1;
        ELSE
            EXIT;
        END IF;
    END LOOP;

    UPDATE public.profiles 
    SET experience = current_exp, level = current_level 
    WHERE id = auth.uid();

    RETURN jsonb_build_object('level', current_level, 'experience', current_exp, 'added', exp_gain);
END;
$$;

-- 6. Add friendships table
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    friend_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, friend_id)
);

-- Enable RLS for friendships
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own friendships" ON public.friendships;
CREATE POLICY "Users can view their own friendships" ON public.friendships
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can send friend requests" ON public.friendships;
CREATE POLICY "Users can send friend requests" ON public.friendships
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own friendships" ON public.friendships;
CREATE POLICY "Users can update their own friendships" ON public.friendships
    FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can delete their own friendships" ON public.friendships;
CREATE POLICY "Users can delete their own friendships" ON public.friendships
    FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Ensure indexes for search
CREATE INDEX IF NOT EXISTS idx_profiles_user_code ON public.profiles(user_code);
CREATE INDEX IF NOT EXISTS idx_profiles_nickname ON public.profiles(nickname);

