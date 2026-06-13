-- Add first-class friend direct messages and room invitations.
-- All client writes go through RPCs so friendship, Keeper, invite, and
-- password-bypass checks happen in one database transaction.

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  member_low_id uuid not null references public.profiles(id) on delete cascade,
  member_high_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  check (member_low_id < member_high_id),
  unique (member_low_id, member_high_id)
);

create table if not exists public.direct_conversation_members (
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  primary key (conversation_id, user_id)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  check (char_length(trim(content)) > 0),
  check (char_length(content) <= 4000)
);

create table if not exists public.room_invitations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  created_by_user_id uuid not null references public.profiles(id) on delete cascade,
  invite_type text not null check (invite_type in ('friend', 'link')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'revoked')),
  starts_at timestamp with time zone,
  note text,
  token_hash text unique,
  expires_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.room_invitation_recipients (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.room_invitations(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'revoked')),
  responded_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (invitation_id, recipient_user_id)
);

create table if not exists public.room_invitation_uses (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.room_invitations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid references public.characters(id) on delete set null,
  used_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (invitation_id, user_id)
);

alter table public.direct_conversations enable row level security;
alter table public.direct_conversation_members enable row level security;
alter table public.direct_messages enable row level security;
alter table public.room_invitations enable row level security;
alter table public.room_invitation_recipients enable row level security;
alter table public.room_invitation_uses enable row level security;

grant select on table public.direct_conversations to authenticated;
grant select on table public.direct_conversation_members to authenticated;
grant select on table public.direct_messages to authenticated;
grant select on table public.room_invitations to authenticated;
grant select on table public.room_invitation_recipients to authenticated;
grant select on table public.room_invitation_uses to authenticated;

create index if not exists idx_direct_conversation_members_user
  on public.direct_conversation_members(user_id, updated_at desc);

create index if not exists idx_direct_messages_conversation_created
  on public.direct_messages(conversation_id, created_at desc);

create index if not exists idx_room_invitations_room_status
  on public.room_invitations(room_id, status);

create index if not exists idx_room_invitations_creator
  on public.room_invitations(created_by_user_id, created_at desc);

create index if not exists idx_room_invitation_recipients_user_status
  on public.room_invitation_recipients(recipient_user_id, status, created_at desc);

create index if not exists idx_room_invitation_uses_user
  on public.room_invitation_uses(user_id, used_at desc);

drop policy if exists "Users can view their direct conversations" on public.direct_conversations;
create policy "Users can view their direct conversations"
on public.direct_conversations
for select
to authenticated
using (
  exists (
    select 1
    from public.direct_conversation_members m
    where m.conversation_id = direct_conversations.id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can view their own direct membership rows" on public.direct_conversation_members;
create policy "Users can view their own direct membership rows"
on public.direct_conversation_members
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can view messages in their direct conversations" on public.direct_messages;
create policy "Users can view messages in their direct conversations"
on public.direct_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.direct_conversation_members m
    where m.conversation_id = direct_messages.conversation_id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists "Room invitation creators and recipients can view invitations" on public.room_invitations;
create policy "Room invitation creators and recipients can view invitations"
on public.room_invitations
for select
to authenticated
using (
  created_by_user_id = (select auth.uid())
  or exists (
    select 1
    from public.room_invitation_recipients recipient
    where recipient.invitation_id = room_invitations.id
      and recipient.recipient_user_id = (select auth.uid())
  )
);

drop policy if exists "Room invitation creators and recipients can view recipient rows" on public.room_invitation_recipients;
create policy "Room invitation creators and recipients can view recipient rows"
on public.room_invitation_recipients
for select
to authenticated
using (
  recipient_user_id = (select auth.uid())
  or exists (
    select 1
    from public.room_invitations invitation
    where invitation.id = room_invitation_recipients.invitation_id
      and invitation.created_by_user_id = (select auth.uid())
  )
);

drop policy if exists "Room invitation users and creators can view uses" on public.room_invitation_uses;
create policy "Room invitation users and creators can view uses"
on public.room_invitation_uses
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.room_invitations invitation
    where invitation.id = room_invitation_uses.invitation_id
      and invitation.created_by_user_id = (select auth.uid())
  )
);

create or replace function app_private.are_accepted_friends(
  p_user_id uuid,
  p_friend_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.friendships friendship
    where friendship.status = 'accepted'
      and (
        (friendship.user_id = p_user_id and friendship.friend_id = p_friend_id)
        or (friendship.user_id = p_friend_id and friendship.friend_id = p_user_id)
      )
  );
$$;

create or replace function app_private.hash_room_invite_token(p_token text)
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

create or replace function app_private.generate_room_invite_token()
returns text
language sql
security definer
set search_path = public
as $$
  select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
$$;

create or replace function app_private.join_room_authorized(
  p_room_id uuid,
  p_character_id uuid default null,
  p_password text default null,
  p_password_already_verified boolean default false
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

  if coalesce(v_room.has_password, false)
     and not v_has_active_membership
     and not p_password_already_verified then
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
      when coalesce(v_room.has_password, false) or p_password_already_verified
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

create or replace function app_private.join_room(
  p_room_id uuid,
  p_character_id uuid default null,
  p_password text default null
)
returns public.room_members
language sql
security definer
set search_path = public, app_private
as $$
  select app_private.join_room_authorized(p_room_id, p_character_id, p_password, false);
$$;

create or replace function app_private.send_direct_message(
  p_recipient_user_id uuid,
  p_content text
)
returns public.direct_messages
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_sender_id uuid := auth.uid();
  v_member_low_id uuid;
  v_member_high_id uuid;
  v_conversation_id uuid;
  v_message public.direct_messages;
begin
  if v_sender_id is null then
    raise exception 'Unauthorized';
  end if;

  if p_recipient_user_id is null or p_recipient_user_id = v_sender_id then
    raise exception 'Invalid recipient';
  end if;

  if char_length(trim(coalesce(p_content, ''))) = 0 then
    raise exception 'Message content is required';
  end if;

  if char_length(p_content) > 4000 then
    raise exception 'Message content is too long';
  end if;

  if not app_private.are_accepted_friends(v_sender_id, p_recipient_user_id) then
    raise exception 'Direct messages are only available between friends';
  end if;

  v_member_low_id := least(v_sender_id, p_recipient_user_id);
  v_member_high_id := greatest(v_sender_id, p_recipient_user_id);

  insert into public.direct_conversations (member_low_id, member_high_id, updated_at)
  values (v_member_low_id, v_member_high_id, timezone('utc'::text, now()))
  on conflict (member_low_id, member_high_id) do update
  set updated_at = timezone('utc'::text, now())
  returning id into v_conversation_id;

  insert into public.direct_conversation_members (conversation_id, user_id)
  values
    (v_conversation_id, v_sender_id),
    (v_conversation_id, p_recipient_user_id)
  on conflict (conversation_id, user_id) do nothing;

  insert into public.direct_messages (conversation_id, sender_id, content)
  values (v_conversation_id, v_sender_id, trim(p_content))
  returning * into v_message;

  update public.direct_conversation_members
  set last_read_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  where conversation_id = v_conversation_id
    and user_id = v_sender_id;

  update public.direct_conversation_members
  set updated_at = timezone('utc'::text, now())
  where conversation_id = v_conversation_id
    and user_id = p_recipient_user_id;

  return v_message;
end;
$$;

create or replace function app_private.get_or_create_direct_conversation(
  p_friend_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_member_low_id uuid;
  v_member_high_id uuid;
  v_conversation_id uuid;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if p_friend_user_id is null or p_friend_user_id = v_user_id then
    raise exception 'Invalid recipient';
  end if;

  if not app_private.are_accepted_friends(v_user_id, p_friend_user_id) then
    raise exception 'Direct messages are only available between friends';
  end if;

  v_member_low_id := least(v_user_id, p_friend_user_id);
  v_member_high_id := greatest(v_user_id, p_friend_user_id);

  insert into public.direct_conversations (member_low_id, member_high_id, updated_at)
  values (v_member_low_id, v_member_high_id, timezone('utc'::text, now()))
  on conflict (member_low_id, member_high_id) do update
  set updated_at = direct_conversations.updated_at
  returning id into v_conversation_id;

  insert into public.direct_conversation_members (conversation_id, user_id)
  values
    (v_conversation_id, v_user_id),
    (v_conversation_id, p_friend_user_id)
  on conflict (conversation_id, user_id) do nothing;

  return v_conversation_id;
end;
$$;

create or replace function app_private.mark_direct_conversation_read(
  p_conversation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  update public.direct_conversation_members
  set last_read_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  where conversation_id = p_conversation_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Conversation not found';
  end if;
end;
$$;

create or replace function app_private.get_direct_conversation_summaries()
returns table (
  conversation_id uuid,
  friend_user_id uuid,
  friend_nickname text,
  friend_avatar_url text,
  friend_user_code integer,
  last_message_id uuid,
  last_message_content text,
  last_message_sender_id uuid,
  last_message_created_at timestamp with time zone,
  unread_count bigint
)
language sql
security definer
set search_path = public
as $$
  with my_memberships as (
    select m.conversation_id, m.last_read_at
    from public.direct_conversation_members m
    where m.user_id = (select auth.uid())
  )
  select
    c.id as conversation_id,
    friend.id as friend_user_id,
    friend.nickname as friend_nickname,
    friend.avatar_url as friend_avatar_url,
    friend.user_code as friend_user_code,
    latest.id as last_message_id,
    latest.content as last_message_content,
    latest.sender_id as last_message_sender_id,
    latest.created_at as last_message_created_at,
    (
      select count(*)
      from public.direct_messages unread_message
      where unread_message.conversation_id = c.id
        and unread_message.sender_id <> (select auth.uid())
        and unread_message.created_at > coalesce(my_memberships.last_read_at, '-infinity'::timestamp with time zone)
    ) as unread_count
  from my_memberships
  join public.direct_conversations c on c.id = my_memberships.conversation_id
  join public.profiles friend
    on friend.id = case
      when c.member_low_id = (select auth.uid()) then c.member_high_id
      else c.member_low_id
    end
  left join lateral (
    select dm.id, dm.content, dm.sender_id, dm.created_at
    from public.direct_messages dm
    where dm.conversation_id = c.id
    order by dm.created_at desc
    limit 1
  ) latest on true
  order by coalesce(latest.created_at, c.updated_at) desc;
$$;

create or replace function app_private.get_social_message_badge_counts()
returns table (
  unread_direct_count bigint,
  pending_room_invitation_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce((
      select count(*)
      from public.direct_conversation_members m
      join public.direct_messages dm on dm.conversation_id = m.conversation_id
      where m.user_id = (select auth.uid())
        and dm.sender_id <> (select auth.uid())
        and dm.created_at > coalesce(m.last_read_at, '-infinity'::timestamp with time zone)
    ), 0)::bigint as unread_direct_count,
    coalesce((
      select count(*)
      from public.room_invitation_recipients recipient
      join public.room_invitations invitation on invitation.id = recipient.invitation_id
      join public.rooms room on room.id = invitation.room_id
      where recipient.recipient_user_id = (select auth.uid())
        and recipient.status = 'pending'
        and invitation.status = 'pending'
        and (invitation.expires_at is null or invitation.expires_at > timezone('utc'::text, now()))
        and room.status not in ('archived', 'completed')
    ), 0)::bigint as pending_room_invitation_count;
$$;

create or replace function app_private.create_room_friend_invitation(
  p_room_id uuid,
  p_recipient_user_id uuid,
  p_starts_at timestamp with time zone default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_room record;
  v_invitation_id uuid;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select id, kp_id, status
  into v_room
  from public.rooms
  where id = p_room_id;

  if v_room.id is null then
    raise exception 'Room not found';
  end if;

  if v_room.kp_id <> v_user_id then
    raise exception 'Only the room keeper can create invitations';
  end if;

  if v_room.status in ('archived', 'completed') then
    raise exception 'Room is not inviteable';
  end if;

  if p_recipient_user_id is null or p_recipient_user_id = v_user_id then
    raise exception 'Invalid recipient';
  end if;

  if not app_private.are_accepted_friends(v_user_id, p_recipient_user_id) then
    raise exception 'Room invitations can only be sent to friends';
  end if;

  update public.room_invitation_recipients recipient
  set status = 'revoked',
      updated_at = timezone('utc'::text, now())
  from public.room_invitations invitation
  where recipient.invitation_id = invitation.id
    and invitation.room_id = p_room_id
    and invitation.created_by_user_id = v_user_id
    and invitation.invite_type = 'friend'
    and invitation.status = 'pending'
    and recipient.recipient_user_id = p_recipient_user_id
    and recipient.status = 'pending';

  update public.room_invitations invitation
  set status = 'revoked',
      updated_at = timezone('utc'::text, now())
  where invitation.room_id = p_room_id
    and invitation.created_by_user_id = v_user_id
    and invitation.invite_type = 'friend'
    and invitation.status = 'pending'
    and exists (
      select 1
      from public.room_invitation_recipients recipient
      where recipient.invitation_id = invitation.id
        and recipient.recipient_user_id = p_recipient_user_id
        and recipient.status = 'revoked'
    );

  insert into public.room_invitations (
    room_id,
    created_by_user_id,
    invite_type,
    status,
    starts_at,
    note
  )
  values (
    p_room_id,
    v_user_id,
    'friend',
    'pending',
    p_starts_at,
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning id into v_invitation_id;

  insert into public.room_invitation_recipients (
    invitation_id,
    recipient_user_id,
    status
  )
  values (v_invitation_id, p_recipient_user_id, 'pending');

  return v_invitation_id;
end;
$$;

create or replace function app_private.create_room_link_invitation(
  p_room_id uuid,
  p_starts_at timestamp with time zone default null,
  p_note text default null
)
returns table (
  invitation_id uuid,
  token text,
  expires_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_room record;
  v_token text;
  v_token_hash text;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select id, kp_id, status
  into v_room
  from public.rooms
  where id = p_room_id;

  if v_room.id is null then
    raise exception 'Room not found';
  end if;

  if v_room.kp_id <> v_user_id then
    raise exception 'Only the room keeper can create invitations';
  end if;

  if v_room.status in ('archived', 'completed') then
    raise exception 'Room is not inviteable';
  end if;

  update public.room_invitations
  set status = 'revoked',
      updated_at = timezone('utc'::text, now())
  where room_id = p_room_id
    and created_by_user_id = v_user_id
    and invite_type = 'link'
    and status = 'pending';

  v_token := app_private.generate_room_invite_token();
  v_token_hash := app_private.hash_room_invite_token(v_token);

  insert into public.room_invitations (
    room_id,
    created_by_user_id,
    invite_type,
    status,
    starts_at,
    note,
    token_hash,
    expires_at
  )
  values (
    p_room_id,
    v_user_id,
    'link',
    'pending',
    p_starts_at,
    nullif(trim(coalesce(p_note, '')), ''),
    v_token_hash,
    timezone('utc'::text, now()) + interval '7 days'
  )
  returning id, room_invitations.expires_at
  into invitation_id, expires_at;

  token := v_token;
  return next;
end;
$$;

create or replace function app_private.get_room_invitation_inbox()
returns table (
  invitation_id uuid,
  recipient_id uuid,
  room_id uuid,
  room_title text,
  room_description text,
  room_cover_image_url text,
  room_type text,
  room_has_password boolean,
  keeper_user_id uuid,
  keeper_nickname text,
  keeper_avatar_url text,
  invite_type text,
  invitation_status text,
  recipient_status text,
  starts_at timestamp with time zone,
  note text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone
)
language sql
security definer
set search_path = public
as $$
  select
    invitation.id as invitation_id,
    recipient.id as recipient_id,
    room.id as room_id,
    room.title as room_title,
    room.description as room_description,
    room.cover_image_url as room_cover_image_url,
    room.type as room_type,
    room.has_password as room_has_password,
    invitation.created_by_user_id as keeper_user_id,
    keeper.nickname as keeper_nickname,
    keeper.avatar_url as keeper_avatar_url,
    invitation.invite_type,
    invitation.status as invitation_status,
    recipient.status as recipient_status,
    invitation.starts_at,
    invitation.note,
    invitation.expires_at,
    invitation.created_at
  from public.room_invitation_recipients recipient
  join public.room_invitations invitation on invitation.id = recipient.invitation_id
  join public.rooms room on room.id = invitation.room_id
  left join public.profiles keeper on keeper.id = invitation.created_by_user_id
  where recipient.recipient_user_id = (select auth.uid())
  order by
    case when recipient.status = 'pending' and invitation.status = 'pending' then 0 else 1 end,
    invitation.created_at desc;
$$;

create or replace function app_private.get_room_invitation_outbox(
  p_room_id uuid default null
)
returns table (
  invitation_id uuid,
  room_id uuid,
  room_title text,
  invite_type text,
  invitation_status text,
  recipient_user_id uuid,
  recipient_nickname text,
  recipient_avatar_url text,
  recipient_status text,
  starts_at timestamp with time zone,
  note text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone
)
language sql
security definer
set search_path = public
as $$
  select
    invitation.id as invitation_id,
    invitation.room_id,
    room.title as room_title,
    invitation.invite_type,
    invitation.status as invitation_status,
    recipient.recipient_user_id,
    profile.nickname as recipient_nickname,
    profile.avatar_url as recipient_avatar_url,
    recipient.status as recipient_status,
    invitation.starts_at,
    invitation.note,
    invitation.expires_at,
    invitation.created_at
  from public.room_invitations invitation
  join public.rooms room on room.id = invitation.room_id
  left join public.room_invitation_recipients recipient on recipient.invitation_id = invitation.id
  left join public.profiles profile on profile.id = recipient.recipient_user_id
  where invitation.created_by_user_id = (select auth.uid())
    and (p_room_id is null or invitation.room_id = p_room_id)
  order by invitation.created_at desc;
$$;

create or replace function app_private.get_room_invite_link_preview(
  p_token text
)
returns table (
  invitation_id uuid,
  room_id uuid,
  room_title text,
  room_description text,
  room_cover_image_url text,
  room_type text,
  room_has_password boolean,
  keeper_user_id uuid,
  keeper_nickname text,
  keeper_avatar_url text,
  starts_at timestamp with time zone,
  note text,
  expires_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  return query
  select
    invitation.id as invitation_id,
    room.id as room_id,
    room.title as room_title,
    room.description as room_description,
    room.cover_image_url as room_cover_image_url,
    room.type as room_type,
    room.has_password as room_has_password,
    invitation.created_by_user_id as keeper_user_id,
    keeper.nickname as keeper_nickname,
    keeper.avatar_url as keeper_avatar_url,
    invitation.starts_at,
    invitation.note,
    invitation.expires_at
  from public.room_invitations invitation
  join public.rooms room on room.id = invitation.room_id
  left join public.profiles keeper on keeper.id = invitation.created_by_user_id
  where invitation.invite_type = 'link'
    and invitation.status = 'pending'
    and invitation.token_hash = app_private.hash_room_invite_token(p_token)
    and invitation.expires_at > timezone('utc'::text, now())
    and room.status not in ('archived', 'completed')
  limit 1;
end;
$$;

create or replace function app_private.accept_room_invitation(
  p_invitation_id uuid,
  p_character_id uuid
)
returns public.room_members
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_invitation record;
  v_membership public.room_members;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select invitation.id, invitation.room_id, invitation.status, invitation.expires_at
  into v_invitation
  from public.room_invitations invitation
  join public.room_invitation_recipients recipient on recipient.invitation_id = invitation.id
  join public.rooms room on room.id = invitation.room_id
  where invitation.id = p_invitation_id
    and invitation.invite_type = 'friend'
    and invitation.status = 'pending'
    and recipient.recipient_user_id = v_user_id
    and recipient.status = 'pending'
    and (invitation.expires_at is null or invitation.expires_at > timezone('utc'::text, now()))
    and room.status not in ('archived', 'completed');

  if v_invitation.id is null then
    raise exception 'Invitation is not available';
  end if;

  if exists (
    select 1
    from public.room_members rm
    where rm.room_id = v_invitation.room_id
      and rm.user_id = v_user_id
      and rm.status = 'kicked'
  ) then
    raise exception 'You were removed from this room';
  end if;

  v_membership := app_private.join_room_authorized(
    v_invitation.room_id,
    p_character_id,
    null,
    true
  );

  update public.room_invitation_recipients
  set status = 'accepted',
      responded_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  where invitation_id = p_invitation_id
    and recipient_user_id = v_user_id;

  update public.room_invitations
  set status = 'accepted',
      updated_at = timezone('utc'::text, now())
  where id = p_invitation_id;

  insert into public.room_invitation_uses (invitation_id, user_id, character_id)
  values (p_invitation_id, v_user_id, p_character_id)
  on conflict (invitation_id, user_id) do update
  set character_id = excluded.character_id,
      used_at = timezone('utc'::text, now());

  return v_membership;
end;
$$;

create or replace function app_private.accept_room_invite_link(
  p_token text,
  p_character_id uuid
)
returns public.room_members
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_invitation record;
  v_membership public.room_members;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select invitation.id, invitation.room_id
  into v_invitation
  from public.room_invitations invitation
  join public.rooms room on room.id = invitation.room_id
  where invitation.invite_type = 'link'
    and invitation.status = 'pending'
    and invitation.token_hash = app_private.hash_room_invite_token(p_token)
    and invitation.expires_at > timezone('utc'::text, now())
    and room.status not in ('archived', 'completed');

  if v_invitation.id is null then
    raise exception 'Invitation link is not available';
  end if;

  if exists (
    select 1
    from public.room_members rm
    where rm.room_id = v_invitation.room_id
      and rm.user_id = v_user_id
      and rm.status = 'kicked'
  ) then
    raise exception 'You were removed from this room';
  end if;

  v_membership := app_private.join_room_authorized(
    v_invitation.room_id,
    p_character_id,
    null,
    true
  );

  insert into public.room_invitation_uses (invitation_id, user_id, character_id)
  values (v_invitation.id, v_user_id, p_character_id)
  on conflict (invitation_id, user_id) do update
  set character_id = excluded.character_id,
      used_at = timezone('utc'::text, now());

  return v_membership;
end;
$$;

create or replace function app_private.decline_room_invitation(
  p_invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  update public.room_invitation_recipients
  set status = 'declined',
      responded_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  where invitation_id = p_invitation_id
    and recipient_user_id = v_user_id
    and status = 'pending';

  if not found then
    raise exception 'Invitation is not available';
  end if;

  update public.room_invitations
  set status = 'declined',
      updated_at = timezone('utc'::text, now())
  where id = p_invitation_id
    and invite_type = 'friend';
end;
$$;

create or replace function app_private.revoke_room_invitation(
  p_invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  update public.room_invitations
  set status = 'revoked',
      updated_at = timezone('utc'::text, now())
  where id = p_invitation_id
    and created_by_user_id = v_user_id
    and status = 'pending';

  if not found then
    raise exception 'Invitation is not available';
  end if;

  update public.room_invitation_recipients
  set status = 'revoked',
      updated_at = timezone('utc'::text, now())
  where invitation_id = p_invitation_id
    and status = 'pending';
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

create or replace function public.send_direct_message(
  p_recipient_user_id uuid,
  p_content text
)
returns public.direct_messages
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.send_direct_message(p_recipient_user_id, p_content);
$$;

create or replace function public.get_or_create_direct_conversation(
  p_friend_user_id uuid
)
returns uuid
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.get_or_create_direct_conversation(p_friend_user_id);
$$;

create or replace function public.mark_direct_conversation_read(p_conversation_id uuid)
returns void
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.mark_direct_conversation_read(p_conversation_id);
$$;

create or replace function public.get_direct_conversation_summaries()
returns table (
  conversation_id uuid,
  friend_user_id uuid,
  friend_nickname text,
  friend_avatar_url text,
  friend_user_code integer,
  last_message_id uuid,
  last_message_content text,
  last_message_sender_id uuid,
  last_message_created_at timestamp with time zone,
  unread_count bigint
)
language sql
security invoker
set search_path = public, app_private
as $$
  select * from app_private.get_direct_conversation_summaries();
$$;

create or replace function public.get_social_message_badge_counts()
returns table (
  unread_direct_count bigint,
  pending_room_invitation_count bigint
)
language sql
security invoker
set search_path = public, app_private
as $$
  select * from app_private.get_social_message_badge_counts();
$$;

create or replace function public.create_room_friend_invitation(
  p_room_id uuid,
  p_recipient_user_id uuid,
  p_starts_at timestamp with time zone default null,
  p_note text default null
)
returns uuid
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.create_room_friend_invitation(
    p_room_id,
    p_recipient_user_id,
    p_starts_at,
    p_note
  );
$$;

create or replace function public.create_room_link_invitation(
  p_room_id uuid,
  p_starts_at timestamp with time zone default null,
  p_note text default null
)
returns table (
  invitation_id uuid,
  token text,
  expires_at timestamp with time zone
)
language sql
security invoker
set search_path = public, app_private
as $$
  select * from app_private.create_room_link_invitation(
    p_room_id,
    p_starts_at,
    p_note
  );
$$;

create or replace function public.get_room_invitation_inbox()
returns table (
  invitation_id uuid,
  recipient_id uuid,
  room_id uuid,
  room_title text,
  room_description text,
  room_cover_image_url text,
  room_type text,
  room_has_password boolean,
  keeper_user_id uuid,
  keeper_nickname text,
  keeper_avatar_url text,
  invite_type text,
  invitation_status text,
  recipient_status text,
  starts_at timestamp with time zone,
  note text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone
)
language sql
security invoker
set search_path = public, app_private
as $$
  select * from app_private.get_room_invitation_inbox();
$$;

create or replace function public.get_room_invitation_outbox(p_room_id uuid default null)
returns table (
  invitation_id uuid,
  room_id uuid,
  room_title text,
  invite_type text,
  invitation_status text,
  recipient_user_id uuid,
  recipient_nickname text,
  recipient_avatar_url text,
  recipient_status text,
  starts_at timestamp with time zone,
  note text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone
)
language sql
security invoker
set search_path = public, app_private
as $$
  select * from app_private.get_room_invitation_outbox(p_room_id);
$$;

create or replace function public.get_room_invite_link_preview(p_token text)
returns table (
  invitation_id uuid,
  room_id uuid,
  room_title text,
  room_description text,
  room_cover_image_url text,
  room_type text,
  room_has_password boolean,
  keeper_user_id uuid,
  keeper_nickname text,
  keeper_avatar_url text,
  starts_at timestamp with time zone,
  note text,
  expires_at timestamp with time zone
)
language sql
security invoker
set search_path = public, app_private
as $$
  select * from app_private.get_room_invite_link_preview(p_token);
$$;

create or replace function public.accept_room_invitation(
  p_invitation_id uuid,
  p_character_id uuid
)
returns public.room_members
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.accept_room_invitation(p_invitation_id, p_character_id);
$$;

create or replace function public.accept_room_invite_link(
  p_token text,
  p_character_id uuid
)
returns public.room_members
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.accept_room_invite_link(p_token, p_character_id);
$$;

create or replace function public.decline_room_invitation(p_invitation_id uuid)
returns void
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.decline_room_invitation(p_invitation_id);
$$;

create or replace function public.revoke_room_invitation(p_invitation_id uuid)
returns void
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.revoke_room_invitation(p_invitation_id);
$$;

revoke all on function app_private.are_accepted_friends(uuid, uuid) from public;
revoke all on function app_private.hash_room_invite_token(text) from public;
revoke all on function app_private.generate_room_invite_token() from public;
revoke all on function app_private.join_room_authorized(uuid, uuid, text, boolean) from public;
revoke all on function app_private.join_room(uuid, uuid, text) from public;
revoke all on function app_private.send_direct_message(uuid, text) from public;
revoke all on function app_private.get_or_create_direct_conversation(uuid) from public;
revoke all on function app_private.mark_direct_conversation_read(uuid) from public;
revoke all on function app_private.get_direct_conversation_summaries() from public;
revoke all on function app_private.get_social_message_badge_counts() from public;
revoke all on function app_private.create_room_friend_invitation(uuid, uuid, timestamp with time zone, text) from public;
revoke all on function app_private.create_room_link_invitation(uuid, timestamp with time zone, text) from public;
revoke all on function app_private.get_room_invitation_inbox() from public;
revoke all on function app_private.get_room_invitation_outbox(uuid) from public;
revoke all on function app_private.get_room_invite_link_preview(text) from public;
revoke all on function app_private.accept_room_invitation(uuid, uuid) from public;
revoke all on function app_private.accept_room_invite_link(text, uuid) from public;
revoke all on function app_private.decline_room_invitation(uuid) from public;
revoke all on function app_private.revoke_room_invitation(uuid) from public;

grant execute on function app_private.are_accepted_friends(uuid, uuid) to authenticated;
grant execute on function app_private.hash_room_invite_token(text) to authenticated;
grant execute on function app_private.generate_room_invite_token() to authenticated;
grant execute on function app_private.join_room_authorized(uuid, uuid, text, boolean) to authenticated;
grant execute on function app_private.join_room(uuid, uuid, text) to authenticated;
grant execute on function app_private.send_direct_message(uuid, text) to authenticated;
grant execute on function app_private.get_or_create_direct_conversation(uuid) to authenticated;
grant execute on function app_private.mark_direct_conversation_read(uuid) to authenticated;
grant execute on function app_private.get_direct_conversation_summaries() to authenticated;
grant execute on function app_private.get_social_message_badge_counts() to authenticated;
grant execute on function app_private.create_room_friend_invitation(uuid, uuid, timestamp with time zone, text) to authenticated;
grant execute on function app_private.create_room_link_invitation(uuid, timestamp with time zone, text) to authenticated;
grant execute on function app_private.get_room_invitation_inbox() to authenticated;
grant execute on function app_private.get_room_invitation_outbox(uuid) to authenticated;
grant execute on function app_private.get_room_invite_link_preview(text) to authenticated;
grant execute on function app_private.accept_room_invitation(uuid, uuid) to authenticated;
grant execute on function app_private.accept_room_invite_link(text, uuid) to authenticated;
grant execute on function app_private.decline_room_invitation(uuid) to authenticated;
grant execute on function app_private.revoke_room_invitation(uuid) to authenticated;

revoke all on function public.send_direct_message(uuid, text) from public;
revoke all on function public.get_or_create_direct_conversation(uuid) from public;
revoke all on function public.mark_direct_conversation_read(uuid) from public;
revoke all on function public.get_direct_conversation_summaries() from public;
revoke all on function public.get_social_message_badge_counts() from public;
revoke all on function public.create_room_friend_invitation(uuid, uuid, timestamp with time zone, text) from public;
revoke all on function public.create_room_link_invitation(uuid, timestamp with time zone, text) from public;
revoke all on function public.get_room_invitation_inbox() from public;
revoke all on function public.get_room_invitation_outbox(uuid) from public;
revoke all on function public.get_room_invite_link_preview(text) from public;
revoke all on function public.accept_room_invitation(uuid, uuid) from public;
revoke all on function public.accept_room_invite_link(text, uuid) from public;
revoke all on function public.decline_room_invitation(uuid) from public;
revoke all on function public.revoke_room_invitation(uuid) from public;

grant execute on function public.send_direct_message(uuid, text) to authenticated;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;
grant execute on function public.mark_direct_conversation_read(uuid) to authenticated;
grant execute on function public.get_direct_conversation_summaries() to authenticated;
grant execute on function public.get_social_message_badge_counts() to authenticated;
grant execute on function public.create_room_friend_invitation(uuid, uuid, timestamp with time zone, text) to authenticated;
grant execute on function public.create_room_link_invitation(uuid, timestamp with time zone, text) to authenticated;
grant execute on function public.get_room_invitation_inbox() to authenticated;
grant execute on function public.get_room_invitation_outbox(uuid) to authenticated;
grant execute on function public.get_room_invite_link_preview(text) to authenticated;
grant execute on function public.accept_room_invitation(uuid, uuid) to authenticated;
grant execute on function public.accept_room_invite_link(text, uuid) to authenticated;
grant execute on function public.decline_room_invitation(uuid) to authenticated;
grant execute on function public.revoke_room_invitation(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.direct_conversation_members;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.direct_messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.room_invitation_recipients;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.room_invitations;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
