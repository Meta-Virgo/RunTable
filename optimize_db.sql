-- =========================================================
-- 数据库性能优化脚本
-- 解决消息过多后发送失败/超时的问题
-- =========================================================

-- 1. 为 messages 表添加索引
-- 这里的 IF NOT EXISTS 可以防止重复创建报错

-- 加速基于房间的消息加载 (解决进入房间慢的问题)
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);

-- 加速基于时间的排序 (解决聊天记录加载慢的问题)
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- 加速系统消息清理触发器 (解决发送消息慢/失败的问题)
-- 触发器需要根据 type 和 created_at 查找旧消息，复合索引效率最高
CREATE INDEX IF NOT EXISTS idx_messages_type_created_at ON public.messages(type, created_at);

-- 2. 为 characters 表添加索引
-- 加速加载房间内的角色列表
CREATE INDEX IF NOT EXISTS idx_characters_room_id ON public.characters(room_id);

-- 3. 为 rooms 表添加索引
-- 加速权限检查 (RLS 策略经常用到 rooms 表)
CREATE INDEX IF NOT EXISTS idx_rooms_kp_id ON public.rooms(kp_id);

-- 4. 优化消息清理触发器 (可选，使其更健壮)
-- 修改 delete_old_system_messages 函数，增加异常捕获，防止清理失败导致无法发消息
CREATE OR REPLACE FUNCTION public.delete_old_system_messages()
RETURNS trigger AS $$
BEGIN
  -- 尝试清理旧消息，但如果失败不阻断主流程
  BEGIN
    DELETE FROM public.messages
    WHERE type = 'system'
      AND created_at < (now() - interval '1 minute')
      AND (
          content LIKE '%进入了房间%' OR
          content LIKE '%离开了房间%' OR
          content LIKE '%移出了房间%'
      );
  EXCEPTION WHEN OTHERS THEN
    -- 忽略错误，确保新消息能发送成功
    NULL;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
