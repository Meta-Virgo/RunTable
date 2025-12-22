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
    password text       -- 新增：房间密码
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