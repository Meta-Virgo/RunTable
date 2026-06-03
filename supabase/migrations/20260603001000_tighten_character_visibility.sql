-- Restrict full character rows to their owner, active room members, and room KPs.
-- Public game history should rely on character snapshots rather than unrestricted
-- reads from the live characters table.

drop policy if exists "Characters are viewable by everyone" on public.characters;
drop policy if exists "Characters visibility" on public.characters;

create policy "Characters visibility"
on public.characters
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.rooms r
    where r.id = characters.room_id
      and r.kp_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.room_members rm
    where rm.room_id = characters.room_id
      and rm.user_id = (select auth.uid())
      and rm.status = 'active'
  )
);

create or replace function app_private.get_room_activity_counts(
  p_room_ids uuid[]
)
returns table (
  room_id uuid,
  character_count bigint,
  message_count bigint
)
language sql
security definer
set search_path = public
as $$
  with allowed_rooms as (
    select r.id
    from public.rooms r
    where r.id = any(coalesce(p_room_ids, array[]::uuid[]))
      and (
        r.status = 'open'
        or r.kp_id = auth.uid()
      )
  )
  select
    ar.id as room_id,
    (
      select count(*)
      from public.characters c
      where c.room_id = ar.id
        and c.type = 'investigator'
    ) as character_count,
    (
      select count(*)
      from public.messages m
      where m.room_id = ar.id
    ) as message_count
  from allowed_rooms ar;
$$;

create or replace function public.get_room_activity_counts(
  p_room_ids uuid[]
)
returns table (
  room_id uuid,
  character_count bigint,
  message_count bigint
)
language sql
security invoker
set search_path = public, app_private
as $$
  select * from app_private.get_room_activity_counts(p_room_ids);
$$;

revoke all on function app_private.get_room_activity_counts(uuid[]) from public;
revoke all on function public.get_room_activity_counts(uuid[]) from public;
grant execute on function app_private.get_room_activity_counts(uuid[]) to authenticated;
grant execute on function public.get_room_activity_counts(uuid[]) to authenticated;

notify pgrst, 'reload schema';
