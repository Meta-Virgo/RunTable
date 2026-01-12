-- ========================================================= 
-- 1. 清理旧表及函数 
-- ========================================================= 
DROP TABLE IF EXISTS public.messages CASCADE; 
DROP TABLE IF EXISTS public.characters CASCADE; 
DROP TABLE IF EXISTS public.rooms CASCADE; 
DROP TABLE IF EXISTS public.profiles CASCADE; 
DROP SEQUENCE IF EXISTS public.user_code_seq CASCADE; 

-- 清理触发器函数，防止重复定义报错 
DROP FUNCTION IF EXISTS public.cleanup_room_characters CASCADE; 
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE; 

-- ========================================================= 
-- 2. 创建表结构 (Profiles) 
-- ========================================================= 
CREATE SEQUENCE public.user_code_seq START 10001; 

CREATE TABLE public.profiles ( 
    id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY, 
    nickname text, 
    bio text, 
    user_code int NOT NULL DEFAULT nextval('public.user_code_seq'), 
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()) 
); 

-- ========================================================= 
-- 3. 创建表结构 (Rooms) 
-- ========================================================= 
CREATE TABLE public.rooms ( 
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, 
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()), 
    kp_id uuid NOT NULL REFERENCES auth.users(id), -- 关联到用户 
    title text NOT NULL, 
    description text, 
    status text DEFAULT 'open'::text,
    room_number serial, -- 新增：房间编号 (自动递增)
    password text,       -- 新增：房间密码
    bg_music_url text    -- 新增：背景音乐
); 

-- ========================================================= 
-- 4. 创建表结构 (Characters) 
-- ========================================================= 
CREATE TABLE public.characters ( 
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, 
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()), 
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()), 
    
    -- 关联字段 
    user_id uuid NOT NULL REFERENCES auth.users(id), 
    room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL, 
    
    -- 基础信息 
    name text NOT NULL, 
    role text DEFAULT '调查员', 
    type text DEFAULT 'investigator'::text, 
    theme_color text DEFAULT '#6366f1'::text, 
    inventory text, 
    
    -- JSONB 数据 
    info jsonb DEFAULT '{}'::jsonb, 
    stats jsonb DEFAULT '{}'::jsonb 
); 

-- ========================================================= 
-- 5. 创建表结构 (Messages) 
-- ========================================================= 
CREATE TABLE public.messages ( 
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, 
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()), 
    
    -- 关联字段 
    room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE, -- 房间删，消息没 
    user_id uuid NOT NULL REFERENCES auth.users(id), 
    character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL, -- 人卡删了，消息保留（只是没头像了） 
    recipient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- 私聊接收者 (NULL 为公开) 
    
    -- 内容 
    type text DEFAULT 'text'::text, 
    content text, 
    meta jsonb DEFAULT '{}'::jsonb 
); 

-- ========================================================= 
-- 6. 开启 RLS (行级安全策略) 并配置策略 
-- ========================================================= 

-- 6.1 开启锁 
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY; 

-- 6.2 Profiles 策略 
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true); 
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id); 
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id); 

-- 6.3 Rooms 策略 
CREATE POLICY "Rooms are viewable by everyone" ON public.rooms FOR SELECT USING (true); 
CREATE POLICY "Authenticated users can create rooms" ON public.rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = kp_id); 
CREATE POLICY "KP can update rooms" ON public.rooms FOR UPDATE USING (auth.uid() = kp_id); 
CREATE POLICY "KP can delete rooms" ON public.rooms FOR DELETE USING (auth.uid() = kp_id); 

-- 6.4 Characters 策略 
CREATE POLICY "Characters are viewable by everyone" ON public.characters FOR SELECT USING (true); 
CREATE POLICY "Users can create characters" ON public.characters FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id); 
-- 允许房主(KP)修改/删除角色 
CREATE POLICY "Owner or KP can update characters" ON public.characters FOR UPDATE USING ( 
    auth.uid() = user_id OR 
    auth.uid() IN (SELECT kp_id FROM public.rooms WHERE id = room_id) 
) WITH CHECK (
    auth.uid() = user_id OR 
    auth.uid() IN (SELECT kp_id FROM public.rooms WHERE id = room_id) OR
    room_id IS NULL
); 
CREATE POLICY "Owner or KP can delete characters" ON public.characters FOR DELETE USING ( 
    auth.uid() = user_id OR 
    auth.uid() IN (SELECT kp_id FROM public.rooms WHERE id = room_id) 
); 

-- 6.5 Messages 策略 
-- 修改：私聊可见性逻辑 
-- 1. 接收者为 NULL (公开) 
-- 2. 当前用户是发送者 
-- 3. 当前用户是接收者 
-- 4. 当前用户是该房间的 KP (上帝视角) 
CREATE POLICY "Messages visibility" ON public.messages FOR SELECT USING ( 
    recipient_id IS NULL OR 
    auth.uid() = user_id OR 
    auth.uid() = recipient_id OR 
    auth.uid() IN (SELECT kp_id FROM public.rooms WHERE id = room_id) 
); 

CREATE POLICY "Authenticated users can insert messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id); 

-- 允许 KP 删除其房间内的消息
CREATE POLICY "KP can delete room messages" ON public.messages FOR DELETE USING (
    auth.uid() IN (SELECT kp_id FROM public.rooms WHERE id = room_id)
);

-- 允许用户删除自己的消息
CREATE POLICY "Users can delete own messages" ON public.messages FOR DELETE USING (
    auth.uid() = user_id
);

-- ========================================================= 
-- 7. 设置 Realtime (实时监听) 
-- ========================================================= 
DROP PUBLICATION IF EXISTS supabase_realtime; 
CREATE PUBLICATION supabase_realtime FOR TABLE public.rooms, public.characters, public.messages; 

-- ========================================================= 
-- 8. 自动处理新用户注册 
-- ========================================================= 
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$ 
BEGIN 
  INSERT INTO public.profiles (id, nickname) 
  VALUES (new.id, split_part(new.email, '@', 1)); 
  RETURN new; 
END; 
$$ LANGUAGE plpgsql SECURITY DEFINER; 

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users; 
CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users 
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user(); 

-- ========================================================= 
-- 9.智能清理逻辑 (只删怪物/NPC，保留调查员) 
-- ========================================================= 

-- 9.1 定义清理函数 
CREATE OR REPLACE FUNCTION public.cleanup_room_characters() 
RETURNS TRIGGER AS $$ 
BEGIN 
  DELETE FROM public.characters 
  WHERE room_id = OLD.id 
  AND type != 'investigator'; 
  RETURN OLD; 
END; 
$$ LANGUAGE plpgsql SECURITY DEFINER; 

-- 9.2 绑定触发器到 rooms 表 
DROP TRIGGER IF EXISTS before_room_delete ON public.rooms; 

CREATE TRIGGER before_room_delete 
BEFORE DELETE ON public.rooms 
FOR EACH ROW 
EXECUTE PROCEDURE public.cleanup_room_characters();

alter table "public"."profiles" add column "is_vip" boolean not null default false;

-- ========================================================= 
-- 10. 自动清理过期系统消息
-- ========================================================= 
CREATE OR REPLACE FUNCTION public.delete_old_system_messages()
RETURNS trigger AS $$
BEGIN
  -- Delete system messages older than 1 minute
  DELETE FROM public.messages
  WHERE type = 'system'
    AND created_at < (now() - interval '1 minute')
    AND (
        content LIKE '%进入了房间%' OR
        content LIKE '%离开了房间%' OR
        content LIKE '%移出了房间%'
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_delete_old_system_messages ON public.messages;
CREATE TRIGGER trigger_delete_old_system_messages
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE PROCEDURE public.delete_old_system_messages();

-- ========================================================= 
-- 11. 跑团履历 (Game History)
-- ========================================================= 

-- 11.1 创建履历主表
CREATE TABLE public.game_histories (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL, 
    room_title text NOT NULL,
    room_description text,
    start_time timestamp with time zone, 
    end_time timestamp with time zone DEFAULT timezone('utc'::text, now()),
    kp_id uuid NOT NULL REFERENCES auth.users(id), 
    kp_nickname text 
);

-- 11.2 创建履历参与者表
CREATE TABLE public.game_history_participants (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    game_history_id uuid NOT NULL REFERENCES public.game_histories(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    user_nickname text,
    character_snapshot jsonb NOT NULL, 
    outcome text NOT NULL CHECK (outcome IN ('存活', '死亡', '失踪', '疯狂'))
);

-- 11.3 开启 RLS
ALTER TABLE public.game_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_history_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game histories are viewable by everyone" ON public.game_histories FOR SELECT USING (true);
CREATE POLICY "Game participants are viewable by everyone" ON public.game_history_participants FOR SELECT USING (true);

-- 11.4 结团 API (RPC Function)
CREATE OR REPLACE FUNCTION public.conclude_game(
    p_room_id uuid,
    p_outcomes jsonb -- Key-Value: {"user_id": "outcome"}
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room public.rooms%ROWTYPE;
    v_kp_nickname text;
    v_new_history_id uuid;
    v_char record;
    v_outcome text;
BEGIN
    -- 1. Verify KP
    SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
    IF v_room.id IS NULL THEN
        RAISE EXCEPTION 'Room not found';
    END IF;
    
    IF v_room.kp_id != auth.uid() THEN
        RAISE EXCEPTION 'Only KP can conclude the game';
    END IF;

    -- 2. Get KP nickname
    SELECT nickname INTO v_kp_nickname FROM public.profiles WHERE id = v_room.kp_id;
    IF v_kp_nickname IS NULL THEN
        v_kp_nickname := 'Unknown Keeper';
    END IF;

    -- 3. Create History
    INSERT INTO public.game_histories (
        room_id, room_title, room_description, start_time, end_time, kp_id, kp_nickname
    ) VALUES (
        v_room.id, v_room.title, v_room.description, v_room.created_at, now(), v_room.kp_id, v_kp_nickname
    ) RETURNING id INTO v_new_history_id;

    -- Safety check for RLS/Trigger issues
    IF v_new_history_id IS NULL THEN
        RAISE EXCEPTION 'Failed to create game history: ID returned NULL. Check RLS policies.';
    END IF;

    -- 4. Process Characters
    FOR v_char IN 
        SELECT c.*, p.nickname as user_nickname 
        FROM public.characters c
        JOIN public.profiles p ON c.user_id = p.id
        WHERE c.room_id = p_room_id AND c.type = 'investigator'
    LOOP
        -- Find outcome for this user
        v_outcome := p_outcomes->>v_char.user_id::text;
        
        IF v_outcome IS NULL THEN
            v_outcome := '存活'; -- Default
        END IF;

        INSERT INTO public.game_history_participants (
            game_history_id, user_id, user_nickname, character_snapshot, outcome
        ) VALUES (
            v_new_history_id, 
            v_char.user_id, 
            v_char.user_nickname, 
            row_to_json(v_char)::jsonb, 
            v_outcome
        );
    END LOOP;

    -- 5. Update Room Status
    UPDATE public.rooms SET status = 'completed' WHERE id = p_room_id;

    RETURN v_new_history_id;
END;
$$;
