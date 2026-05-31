# room_members Design

## Purpose

`room_members` makes room membership a database fact instead of a frontend-only state.
It should become the authorization source for room chat, private messages, voice tokens,
password rooms, kicks, and future member lists.

This design keeps the first rollout compatible with the current app:

- `rooms` remains the lobby/catalog table.
- `characters.room_id` remains the selected/bound character signal for now.
- Supabase Presence remains the online/offline signal.
- A normal "leave room" action returns the user to the lobby but does not remove membership.
- A KP kick or a future explicit "withdraw from room" action changes membership status.

## Current Problem

The current flow is mostly:

1. User selects a room in the lobby.
2. If `rooms.has_password` is true, the frontend calls `verify_room_password`.
3. The app calls `assignCharacterToRoom`, which updates `characters.room_id`.
4. Messages are inserted if `messages.user_id = auth.uid()`.

This means a logged-in user can bypass the UI and call the Data API directly. The database
does not currently require the user to be a room member before inserting a room message.

## Table Shape

```sql
create table public.room_members (
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

create index idx_room_members_user_status
  on public.room_members(user_id, status);

create index idx_room_members_room_status
  on public.room_members(room_id, status);

create index idx_room_members_character_id
  on public.room_members(character_id);
```

### Field Meaning

- `room_id`: room being joined.
- `user_id`: authenticated user.
- `character_id`: selected player character for this room. KP rows can use `null`.
- `role`: `keeper` for room owner, `player` for normal members, `observer` reserved for future spectator/read-only mode.
- `status`: only `active` grants permissions.
- `password_verified_at`: set when a non-KP joins a password room.
- `joined_at`: first join time.
- `last_seen_at`: updated when joining/rejoining.
- `left_at`: only set for explicit withdrawal or kick-like flows; normal UI leave should not set it.

## Membership Semantics

`active` means "authorized room member", not "currently online".

Online state should continue to use Supabase Presence. This avoids breaking the current UX where
players leave the room screen but their character stays bound to the room until they join another
room or are removed by the KP.

## Authoritative RPCs

Direct client inserts into `room_members` should be avoided. Membership transitions should go
through RPCs so password verification, character ownership, and role assignment happen in one
transaction.

### `join_room`

Inputs:

```sql
p_room_id uuid
p_character_id uuid default null
p_password text default null
```

Behavior:

1. Require `auth.uid()` to exist.
2. Load `rooms.id`, `kp_id`, `status`, `has_password`, `type`.
3. Reject missing or completed rooms.
4. If `auth.uid() = rooms.kp_id`, upsert an active `keeper` membership with `character_id = null`.
5. Otherwise:
   - If `has_password`, verify `p_password` against `room_secrets`.
   - Require `p_character_id` to belong to `auth.uid()`.
   - Require the character type to be `investigator`.
   - Update that character's `room_id` to `p_room_id`.
   - Upsert an active `player` membership with that `character_id`.
6. Clear previous active memberships for the same user only if the product wants "one active room at a time".

Recommended return:

```sql
returns public.room_members
```

### `kick_room_member`

Inputs:

```sql
p_room_id uuid
p_user_id uuid
```

Behavior:

1. Require caller to be the room KP.
2. Prevent kicking the KP.
3. Set `room_members.status = 'kicked'`, `left_at = now()`.
4. Set the kicked member's selected `characters.room_id = null`.
5. Let the existing app insert the system message, or move that insert into the RPC later.

### `refresh_room_member`

Optional lightweight RPC for updating `last_seen_at` when a member re-enters the room.
This is not an online signal; Presence still owns online state.

## RLS Helpers

Prefer simple `exists (...)` checks in policies at first. If helper functions are introduced,
put them in a non-exposed schema such as `app_private`, set explicit `search_path`, and grant
only the minimum needed execute permissions.

Useful predicates:

```sql
exists (
  select 1
  from public.room_members rm
  where rm.room_id = messages.room_id
    and rm.user_id = (select auth.uid())
    and rm.status = 'active'
)
```

```sql
exists (
  select 1
  from public.rooms r
  where r.id = messages.room_id
    and r.kp_id = (select auth.uid())
)
```

## RLS Direction

### `room_members`

Read:

- User can read their own membership rows.
- KP can read memberships in rooms they own.

Write:

- No direct insert from clients.
- No direct delete from clients.
- Updates should be through RPC. A narrow direct update for `last_seen_at` is acceptable later.

### `messages`

The main security fix should happen here.

Insert should require:

- `messages.user_id = auth.uid()`.
- Caller has active membership in `messages.room_id`.
- If `character_id is null`, caller must be the room KP.
- If `character_id is not null`, that character must belong to caller and be bound to the same room.
- If `recipient_id is not null`, recipient must be an active member of the same room.

Select should require:

- Caller is an active room member.
- Public message: `recipient_id is null`.
- Private message: caller is sender, recipient, or KP.

Delete should keep current semantics:

- Sender can delete own message.
- KP can delete messages in their room.

### `characters`

Phase 1 can leave character select as-is to avoid breaking the app.

Phase 2 should restrict full character rows to:

- Character owner.
- Active members of the character's room.
- KP of the character's room.

Lobby pages should avoid depending on full character visibility outside membership.

### `rooms`

Keep room select public for lobby discovery, because it does not expose passwords.
Room content access should be controlled through `room_members`, `messages`, and `characters`.

## Backfill Plan

When introducing the table:

1. Add active `keeper` memberships for all existing rooms.
2. Add active `player` memberships for existing investigator characters with `room_id is not null`.
3. If multiple investigator characters from the same user are in the same room, pick one for `room_members.character_id` and leave all existing `characters.room_id` values untouched.
4. Do not create memberships for NPCs or monsters.

Example backfill shape:

```sql
insert into public.room_members (room_id, user_id, role, status)
select id, kp_id, 'keeper', 'active'
from public.rooms
on conflict (room_id, user_id) do update
set role = 'keeper',
    status = 'active',
    updated_at = timezone('utc'::text, now());

insert into public.room_members (room_id, user_id, character_id, role, status)
select distinct on (room_id, user_id)
  room_id, user_id, id, 'player', 'active'
from public.characters
where room_id is not null
  and type = 'investigator'
order by room_id, user_id, created_at desc
on conflict (room_id, user_id) do update
set character_id = excluded.character_id,
    role = case when room_members.role = 'keeper' then 'keeper' else 'player' end,
    status = 'active',
    updated_at = timezone('utc'::text, now());
```

## Rollout Steps

1. Create `room_members`, indexes, RLS, and backfill. Do not tighten message RLS yet.
2. Add `join_room` RPC and call it from the frontend instead of `verifyRoomPassword + assignCharacterToRoom`.
3. Add `kick_room_member` RPC and use it from KP remove flow.
4. Verify normal flows: create room, join text room, join password room, join voice room, send public/private messages, kick player, refresh page.
5. Tighten `messages` RLS to require active membership.
6. Later tighten `characters` RLS after lobby/history dependencies are checked.

## Expected Impact

If rolled out in phases, step 1 should not change user-visible behavior.

The behavior changes begin when the app starts using `join_room` and especially when message RLS
is tightened. At that point, users who are not active room members will no longer be able to read
or write room messages through direct API calls.

## Rollback

If message access breaks after RLS tightening, temporarily restore the old `messages` select and
insert policies while keeping `room_members` data. This preserves the new membership data and lets
the app continue running while the frontend/RPC mismatch is fixed.
