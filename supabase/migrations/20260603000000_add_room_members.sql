-- Make room membership an explicit database fact.
-- The app still keeps characters.room_id for UI compatibility, but joins and
-- kicks now go through RPCs so password, ownership, and role checks happen in
-- one transaction.

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid references public.characters(id) on delete set null,
  role text not null default 'player'
    check (role in ('keeper', 'player', 'observer')),
  status text not null default 'active'
    check (status in ('active', 'kicked', 'left')),
  password_verified_at timestamp with time zone,
  joined_at timestamp with time zone not null default timezone('utc'::text, now()),
  last_seen_at timestamp with time zone not null default timezone('utc'::text, now()),
  left_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  primary key (room_id, user_id)
);

alter table public.room_members enable row level security;

create index if not exists idx_room_members_user_status
  on public.room_members(user_id, status);

create index if not exists idx_room_members_room_status
  on public.room_members(room_id, status);

create index if not exists idx_room_members_character_id
  on public.room_members(character_id);

grant select on table public.room_members to authenticated;

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

drop policy if exists "Users and room keepers can view memberships" on public.room_members;
create policy "Users and room keepers can view memberships"
on public.room_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.rooms r
    where r.id = room_members.room_id
      and r.kp_id = (select auth.uid())
  )
);

insert into public.room_members (room_id, user_id, role, status)
select id, kp_id, 'keeper', 'active'
from public.rooms
on conflict (room_id, user_id) do update
set role = 'keeper',
    status = 'active',
    character_id = null,
    left_at = null,
    updated_at = timezone('utc'::text, now());

insert into public.room_members (room_id, user_id, character_id, role, status)
select distinct on (room_id, user_id)
  room_id, user_id, id, 'player', 'active'
from public.characters
where room_id is not null
  and user_id is not null
  and type = 'investigator'
order by room_id, user_id, created_at desc
on conflict (room_id, user_id) do update
set character_id = excluded.character_id,
    role = case when room_members.role = 'keeper' then 'keeper' else 'player' end,
    status = 'active',
    left_at = null,
    updated_at = timezone('utc'::text, now());

create or replace function app_private.join_room(
  p_room_id uuid,
  p_character_id uuid default null,
  p_password text default null
)
returns public.room_members
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_room record;
  v_character record;
  v_password_hash text;
  v_has_active_membership boolean := false;
  v_membership public.room_members;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select id, kp_id, status, has_password
  into v_room
  from public.rooms
  where id = p_room_id;

  if v_room.id is null then
    raise exception 'Room not found';
  end if;

  if v_room.status in ('archived', 'completed') then
    raise exception 'Room is not joinable';
  end if;

  if v_room.kp_id = v_user_id then
    insert into public.room_members (
      room_id,
      user_id,
      character_id,
      role,
      status,
      password_verified_at,
      last_seen_at,
      left_at,
      updated_at
    )
    values (
      p_room_id,
      v_user_id,
      null,
      'keeper',
      'active',
      timezone('utc'::text, now()),
      timezone('utc'::text, now()),
      null,
      timezone('utc'::text, now())
    )
    on conflict (room_id, user_id) do update
    set character_id = null,
        role = 'keeper',
        status = 'active',
        password_verified_at = timezone('utc'::text, now()),
        last_seen_at = timezone('utc'::text, now()),
        left_at = null,
        updated_at = timezone('utc'::text, now())
    returning * into v_membership;

    return v_membership;
  end if;

  if p_character_id is null then
    raise exception 'Character is required';
  end if;

  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = v_user_id
      and rm.status = 'active'
  )
  into v_has_active_membership;

  if coalesce(v_room.has_password, false) and not v_has_active_membership then
    select password_hash
    into v_password_hash
    from public.room_secrets
    where room_id = p_room_id;

    if v_password_hash is null
       or v_password_hash <> extensions.crypt(coalesce(p_password, ''), v_password_hash) then
      raise exception 'Invalid room password';
    end if;
  end if;

  select id, user_id, room_id, type
  into v_character
  from public.characters
  where id = p_character_id;

  if v_character.id is null then
    raise exception 'Character not found';
  end if;

  if v_character.user_id <> v_user_id then
    raise exception 'Character does not belong to current user';
  end if;

  if v_character.type <> 'investigator' then
    raise exception 'Only investigator characters can join rooms';
  end if;

  update public.characters
  set room_id = p_room_id
  where id = p_character_id;

  insert into public.room_members (
    room_id,
    user_id,
    character_id,
    role,
    status,
    password_verified_at,
    last_seen_at,
    left_at,
    updated_at
  )
  values (
    p_room_id,
    v_user_id,
    p_character_id,
    'player',
    'active',
    case
      when coalesce(v_room.has_password, false)
        then timezone('utc'::text, now())
      else null
    end,
    timezone('utc'::text, now()),
    null,
    timezone('utc'::text, now())
  )
  on conflict (room_id, user_id) do update
  set character_id = excluded.character_id,
      role = case
        when room_members.role = 'keeper' then 'keeper'
        else 'player'
      end,
      status = 'active',
      password_verified_at = coalesce(
        excluded.password_verified_at,
        room_members.password_verified_at
      ),
      last_seen_at = timezone('utc'::text, now()),
      left_at = null,
      updated_at = timezone('utc'::text, now())
  returning * into v_membership;

  return v_membership;
end;
$$;

create or replace function app_private.kick_room_member(
  p_room_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_kp_id uuid;
  v_character_id uuid;
begin
  if v_caller_id is null then
    raise exception 'Unauthorized';
  end if;

  select kp_id
  into v_kp_id
  from public.rooms
  where id = p_room_id;

  if v_kp_id is null then
    raise exception 'Room not found';
  end if;

  if v_kp_id <> v_caller_id then
    raise exception 'Only the room keeper can kick members';
  end if;

  if p_user_id = v_kp_id then
    raise exception 'The keeper cannot be kicked';
  end if;

  select character_id
  into v_character_id
  from public.room_members
  where room_id = p_room_id
    and user_id = p_user_id;

  if v_character_id is null then
    select id
    into v_character_id
    from public.characters
    where room_id = p_room_id
      and user_id = p_user_id
      and type = 'investigator'
    order by created_at desc
    limit 1;
  end if;

  insert into public.room_members (
    room_id,
    user_id,
    character_id,
    role,
    status,
    left_at,
    updated_at
  )
  values (
    p_room_id,
    p_user_id,
    v_character_id,
    'player',
    'kicked',
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  on conflict (room_id, user_id) do update
  set character_id = coalesce(room_members.character_id, excluded.character_id),
      status = 'kicked',
      left_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now());

  update public.characters
  set room_id = null
  where room_id = p_room_id
    and user_id = p_user_id;

  return true;
end;
$$;

create or replace function public.join_room(
  p_room_id uuid,
  p_character_id uuid default null,
  p_password text default null
)
returns public.room_members
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.join_room(p_room_id, p_character_id, p_password);
$$;

create or replace function public.kick_room_member(
  p_room_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.kick_room_member(p_room_id, p_user_id);
$$;

revoke all on function app_private.join_room(uuid, uuid, text) from public;
revoke all on function app_private.kick_room_member(uuid, uuid) from public;
revoke all on function public.join_room(uuid, uuid, text) from public;
revoke all on function public.kick_room_member(uuid, uuid) from public;
grant execute on function app_private.join_room(uuid, uuid, text) to authenticated;
grant execute on function app_private.kick_room_member(uuid, uuid) to authenticated;
grant execute on function public.join_room(uuid, uuid, text) to authenticated;
grant execute on function public.kick_room_member(uuid, uuid) to authenticated;

drop policy if exists "Authenticated users can insert messages" on public.messages;
create policy "Authenticated users can insert messages"
on public.messages
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.room_members sender_member
    where sender_member.room_id = messages.room_id
      and sender_member.user_id = (select auth.uid())
      and sender_member.status = 'active'
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
      from public.room_members recipient_member
      where recipient_member.room_id = messages.room_id
        and recipient_member.user_id = messages.recipient_id
        and recipient_member.status = 'active'
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

drop policy if exists "Messages visibility" on public.messages;
create policy "Messages visibility"
on public.messages
for select
to authenticated
using (
  (
    exists (
      select 1
      from public.room_members viewer_member
      where viewer_member.room_id = messages.room_id
        and viewer_member.user_id = (select auth.uid())
        and viewer_member.status = 'active'
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

drop policy if exists "Users can delete messages" on public.messages;
create policy "Users can delete messages"
on public.messages
for delete
to authenticated
using (
  (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.room_members sender_member
      where sender_member.room_id = messages.room_id
        and sender_member.user_id = (select auth.uid())
        and sender_member.status = 'active'
    )
  )
  or exists (
    select 1
    from public.rooms r
    where r.id = messages.room_id
      and r.kp_id = (select auth.uid())
  )
);

notify pgrst, 'reload schema';
