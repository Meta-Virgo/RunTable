create or replace function app_private.get_room_id_from_scene_drag_topic(p_topic text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_topic ~ '^room-scenes-drag:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then substring(p_topic from 18)::uuid
    else null
  end;
$$;

create or replace function app_private.can_send_room_scene_drag_broadcast(
  p_topic text,
  p_payload jsonb,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with topic_context as (
    select app_private.get_room_id_from_scene_drag_topic(p_topic) as room_id
  ),
  payload_context as (
    select
      p_payload->>'markerId' as marker_id_text,
      p_payload->>'sceneId' as scene_id_text,
      p_payload->>'characterId' as character_id_text
  ),
  marker_context as (
    select
      marker.id,
      marker.room_id,
      marker.scene_id,
      marker.character_id,
      character.user_id as character_user_id,
      character.type as character_type
    from topic_context
    join public.room_scene_markers marker
      on marker.room_id = topic_context.room_id
    join payload_context
      on payload_context.marker_id_text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and payload_context.scene_id_text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and payload_context.character_id_text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    join public.characters character
      on character.id = marker.character_id
     and character.room_id = marker.room_id
    where marker.id = payload_context.marker_id_text::uuid
      and marker.scene_id = payload_context.scene_id_text::uuid
      and marker.character_id = payload_context.character_id_text::uuid
  )
  select exists (
    select 1
    from marker_context marker
    where (
      app_private.is_room_keeper(marker.room_id, p_user_id)
      or (
        marker.character_user_id = p_user_id
        and marker.character_type = 'investigator'
        and app_private.is_active_room_member(marker.room_id, p_user_id)
      )
    )
  );
$$;

drop policy if exists "Room members can receive scene drag broadcasts"
  on realtime.messages;
create policy "Room members can receive scene drag broadcasts"
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and app_private.get_room_id_from_scene_drag_topic((select realtime.topic())) is not null
  and (
    app_private.is_active_room_member(
      app_private.get_room_id_from_scene_drag_topic((select realtime.topic())),
      (select auth.uid())
    )
    or app_private.is_room_keeper(
      app_private.get_room_id_from_scene_drag_topic((select realtime.topic())),
      (select auth.uid())
    )
  )
);

drop policy if exists "Authorized users can send scene drag broadcasts"
  on realtime.messages;
create policy "Authorized users can send scene drag broadcasts"
on realtime.messages
for insert
to authenticated
with check (
  extension = 'broadcast'
  and event = 'scene-marker-drag'
  and app_private.can_send_room_scene_drag_broadcast(
    (select realtime.topic()),
    payload,
    (select auth.uid())
  )
);

revoke all on function app_private.get_room_id_from_scene_drag_topic(text)
  from public;
revoke all on function app_private.can_send_room_scene_drag_broadcast(text, jsonb, uuid)
  from public;
grant execute on function app_private.get_room_id_from_scene_drag_topic(text)
  to authenticated;
grant execute on function app_private.can_send_room_scene_drag_broadcast(text, jsonb, uuid)
  to authenticated;
