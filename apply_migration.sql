-- 自动清理过期系统消息
-- 将此脚本复制到 Supabase SQL Editor 中运行

CREATE OR REPLACE FUNCTION public.delete_old_system_messages()
RETURNS trigger AS $$
BEGIN
  -- 删除 1 分钟前的系统消息
  -- 仅针对进入/离开/踢出房间的消息
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

-- 创建触发器，在每次插入新消息时检查并清理
DROP TRIGGER IF EXISTS trigger_delete_old_system_messages ON public.messages;
CREATE TRIGGER trigger_delete_old_system_messages
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE PROCEDURE public.delete_old_system_messages();
