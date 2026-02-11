-- 允许用户删除自己的通知
CREATE POLICY "Users can delete own notifications" ON public.notifications
FOR DELETE USING (
    (select auth.uid()) = user_id
);
