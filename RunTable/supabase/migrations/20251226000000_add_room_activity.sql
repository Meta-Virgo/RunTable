-- Add last_active_at column
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS last_active_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- Update existing rooms to have last_active_at = created_at (initial backfill)
-- If we want to be more precise, we could try to find the latest message, but created_at is a safe fallback
UPDATE public.rooms SET last_active_at = created_at WHERE last_active_at IS NULL;

-- Function to update room timestamp
CREATE OR REPLACE FUNCTION public.update_room_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.rooms
  SET last_active_at = timezone('utc'::text, now())
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
-- 1. On new message
DROP TRIGGER IF EXISTS update_room_activity_on_message ON public.messages;
CREATE TRIGGER update_room_activity_on_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE PROCEDURE public.update_room_activity();

-- 2. On character change (join/update)
DROP TRIGGER IF EXISTS update_room_activity_on_character ON public.characters;
CREATE TRIGGER update_room_activity_on_character
AFTER INSERT OR UPDATE ON public.characters
FOR EACH ROW
WHEN (NEW.room_id IS NOT NULL)
EXECUTE PROCEDURE public.update_room_activity();
