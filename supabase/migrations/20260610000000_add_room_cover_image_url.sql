ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS cover_image_url text;

COMMENT ON COLUMN public.rooms.cover_image_url IS 'Optional public cover image URL displayed in the lobby room card.';

CREATE OR REPLACE FUNCTION app_private.get_room_member_user_ids(
  p_room_ids uuid[]
)
RETURNS TABLE (
  room_id uuid,
  user_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH allowed_rooms AS (
    SELECT r.id
    FROM public.rooms r
    WHERE r.id = ANY(COALESCE(p_room_ids, ARRAY[]::uuid[]))
      AND (
        r.status = 'open'
        OR r.kp_id = auth.uid()
      )
  )
  SELECT
    rm.room_id,
    rm.user_id
  FROM public.room_members rm
  JOIN allowed_rooms ar ON ar.id = rm.room_id
  WHERE rm.status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.get_room_member_user_ids(
  p_room_ids uuid[]
)
RETURNS TABLE (
  room_id uuid,
  user_id uuid
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, app_private
AS $$
  SELECT * FROM app_private.get_room_member_user_ids(p_room_ids);
$$;

REVOKE ALL ON FUNCTION app_private.get_room_member_user_ids(uuid[]) FROM public;
REVOKE ALL ON FUNCTION public.get_room_member_user_ids(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION app_private.get_room_member_user_ids(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_room_member_user_ids(uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
