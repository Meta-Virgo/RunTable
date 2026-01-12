-- 确保列存在
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS is_music_playing BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS music_track_index INTEGER DEFAULT 0;

-- 尝试触发 Schema Cache 刷新
-- 方法 1: 添加注释 (通常会触发刷新)
COMMENT ON COLUMN public.rooms.is_music_playing IS '是否正在播放音乐';
COMMENT ON COLUMN public.rooms.music_track_index IS '当前播放的曲目索引';

-- 方法 2: 显式通知 (如果 PostgREST 配置了监听)
NOTIFY pgrst, 'reload schema';
