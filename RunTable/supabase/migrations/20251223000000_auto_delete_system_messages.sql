-- Create a function to delete old system messages
CREATE OR REPLACE FUNCTION public.delete_old_system_messages()
RETURNS trigger AS $$
BEGIN
  -- Delete system messages older than 1 minute
  -- Specifically targeting enter/leave/kick messages as requested
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

-- Create a trigger to run this function on every insert to messages
DROP TRIGGER IF EXISTS trigger_delete_old_system_messages ON public.messages;
CREATE TRIGGER trigger_delete_old_system_messages
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE PROCEDURE public.delete_old_system_messages();
