-- 优化数据库性能，解决消息过多导致发送失败的问题

-- 1. 为 messages 表添加索引
-- 加速基于房间的消息查询
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);

-- 加速基于时间的排序和清理
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- 加速基于类型的查询（用于清理系统消息的触发器）
CREATE INDEX IF NOT EXISTS idx_messages_type ON public.messages(type);

-- 复合索引：加速清理特定类型的旧消息
CREATE INDEX IF NOT EXISTS idx_messages_type_created_at ON public.messages(type, created_at);

-- 2. 为 characters 表添加索引
-- 加速加载房间内的角色
CREATE INDEX IF NOT EXISTS idx_characters_room_id ON public.characters(room_id);

-- 3. 为 rooms 表添加索引
-- 加速 KP 权限检查
CREATE INDEX IF NOT EXISTS idx_rooms_kp_id ON public.rooms(kp_id);
