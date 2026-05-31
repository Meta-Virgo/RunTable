-- Tighten message access around the current room membership model.
-- Until room_members exists, membership is inferred from:
--   1. the user is the room KP, or
--   2. the user owns a character whose room_id is the message room.

drop policy if exists "Authenticated users can insert messages" on public.messages;
drop policy if exists "Messages visibility" on public.messages;

create policy "Authenticated users can insert messages"
on public.messages
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    exists (
      select 1
      from public.rooms r
      where r.id = messages.room_id
        and r.kp_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.characters sender_character
      where sender_character.room_id = messages.room_id
        and sender_character.user_id = (select auth.uid())
    )
  )
  and (
    (
      character_id is null
      and exists (
        select 1
        from public.rooms r
        where r.id = messages.room_id
          and r.kp_id = (select auth.uid())
      )
    )
    or (
      character_id is not null
      and exists (
        select 1
        from public.characters c
        where c.id = messages.character_id
          and c.room_id = messages.room_id
          and c.user_id = (select auth.uid())
      )
    )
  )
  and (
    recipient_id is null
    or exists (
      select 1
      from public.rooms recipient_room
      where recipient_room.id = messages.room_id
        and recipient_room.kp_id = messages.recipient_id
    )
    or exists (
      select 1
      from public.characters recipient_character
      where recipient_character.room_id = messages.room_id
        and recipient_character.user_id = messages.recipient_id
    )
  )
  and (
    type <> 'dice_secret'
    or exists (
      select 1
      from public.rooms r
      where r.id = messages.room_id
        and r.kp_id = (select auth.uid())
    )
  )
);

create policy "Messages visibility"
on public.messages
for select
to authenticated
using (
  (
    (
      exists (
        select 1
        from public.rooms r
        where r.id = messages.room_id
          and r.kp_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.characters viewer_character
        where viewer_character.room_id = messages.room_id
          and viewer_character.user_id = (select auth.uid())
      )
    )
    and (
      recipient_id is null
      or user_id = (select auth.uid())
      or recipient_id = (select auth.uid())
      or exists (
        select 1
        from public.rooms r
        where r.id = messages.room_id
          and r.kp_id = (select auth.uid())
      )
    )
  )
  or (
    type = 'system'
    and meta->>'type' = 'kick'
    and meta->>'userId' = (select auth.uid())::text
  )
);

notify pgrst, 'reload schema';
