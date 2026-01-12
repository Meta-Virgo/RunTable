-- 修复 PC 无法撤回消息的问题
-- 请在 Supabase SQL Editor 中运行此脚本

-- 1. 确保策略存在（先尝试删除以避免重复错误，虽然 CREATE POLICY 不支持 IF NOT EXISTS，但我们可以先 DROP）
DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;

-- 2. 创建允许用户删除自己消息的策略
CREATE POLICY "Users can delete own messages" ON public.messages FOR DELETE USING (
    auth.uid() = user_id
);
