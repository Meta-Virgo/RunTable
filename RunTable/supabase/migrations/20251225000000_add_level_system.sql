-- Add level and experience columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS level INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS experience INT DEFAULT 0;

-- Create daily_activities table
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

-- RLS for daily_activities
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

-- Heartbeat function
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
        -- Only update if last heartbeat was recent (e.g., within 5 minutes) to prevent cheating by changing system time or long sleep
        -- For simplicity, we just add time if the function is called.
        -- But strict logic: if now - last_heartbeat > 5 mins, treat as new session, don't add huge time.
        
        UPDATE public.daily_activities
        SET online_seconds = online_seconds + added_seconds,
            last_heartbeat = timezone('utc'::text, now())
        WHERE user_id = auth.uid() AND activity_date = curr_date
        RETURNING * INTO user_activity;
    END IF;

    RETURN to_jsonb(user_activity);
END;
$$;

-- Claim experience function
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
