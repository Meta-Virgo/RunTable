-- Tighten public API exposure and address current Supabase advisors.
--
-- This migration intentionally keeps app-facing RPCs callable by
-- authenticated users, because the frontend calls them through supabase.rpc().
-- Anonymous access is removed from all SECURITY DEFINER functions, and
-- trigger-only helpers are no longer callable via the Data API.

-- 1. Cover foreign keys currently reported by the performance advisor.
create index if not exists idx_direct_conversations_member_high_id
  on public.direct_conversations (member_high_id);

create index if not exists idx_direct_messages_sender_id
  on public.direct_messages (sender_id);

create index if not exists idx_room_invitation_uses_character_id
  on public.room_invitation_uses (character_id);

create index if not exists idx_room_scenes_created_by_user_id
  on public.room_scenes (created_by_user_id);

create index if not exists idx_room_tabletop_documents_updated_by_user_id
  on public.room_tabletop_documents (updated_by_user_id);

create index if not exists idx_room_tabletop_tokens_updated_by_user_id
  on public.room_tabletop_tokens (updated_by_user_id);

create index if not exists idx_room_tabletop_updates_actor_user_id
  on public.room_tabletop_updates (actor_user_id);

-- 2. Keep clue wall authorization semantics, but let Postgres evaluate
-- auth.uid() once per statement rather than once per row.
drop policy if exists "Allow read access for room participants" on public.clue_walls;
create policy "Allow read access for room participants"
on public.clue_walls
for select
to authenticated
using (
  exists (
    select 1
    from public.characters
    where characters.room_id = clue_walls.room_id
      and characters.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.rooms
    where rooms.id = clue_walls.room_id
      and rooms.kp_id = (select auth.uid())
  )
);

drop policy if exists "Allow insert access for room participants" on public.clue_walls;
create policy "Allow insert access for room participants"
on public.clue_walls
for insert
to authenticated
with check (
  exists (
    select 1
    from public.characters
    where characters.room_id = clue_walls.room_id
      and characters.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.rooms
    where rooms.id = clue_walls.room_id
      and rooms.kp_id = (select auth.uid())
  )
);

drop policy if exists "Allow update access for room participants" on public.clue_walls;
create policy "Allow update access for room participants"
on public.clue_walls
for update
to authenticated
using (
  exists (
    select 1
    from public.characters
    where characters.room_id = clue_walls.room_id
      and characters.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.rooms
    where rooms.id = clue_walls.room_id
      and rooms.kp_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.characters
    where characters.room_id = clue_walls.room_id
      and characters.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.rooms
    where rooms.id = clue_walls.room_id
      and rooms.kp_id = (select auth.uid())
  )
);

-- 3. Public buckets still serve object URLs without a broad SELECT policy.
-- Dropping these policies prevents clients from listing every file in a bucket.
drop policy if exists "Avatar images are publicly accessible." on storage.objects;
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
drop policy if exists "Post images are publicly accessible" on storage.objects;

-- 4. SECURITY DEFINER functions should not be callable through broad PUBLIC
-- execute privileges.
revoke execute on function public.claim_experience(text) from public;
revoke execute on function public.cleanup_room_characters() from public;
revoke execute on function public.clear_room_password_column() from public;
revoke execute on function public.conclude_game(uuid, jsonb) from public;
revoke execute on function public.delete_old_system_messages() from public;
revoke execute on function public.handle_heartbeat() from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.set_room_password(uuid, text) from public;
revoke execute on function public.update_room_activity() from public;
revoke execute on function public.verify_room_password(uuid, text) from public;

-- Also remove any explicit grants that may have been added earlier.
revoke execute on function public.claim_experience(text) from anon;
revoke execute on function public.cleanup_room_characters() from anon;
revoke execute on function public.clear_room_password_column() from anon;
revoke execute on function public.conclude_game(uuid, jsonb) from anon;
revoke execute on function public.delete_old_system_messages() from anon;
revoke execute on function public.handle_heartbeat() from anon;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.set_room_password(uuid, text) from anon;
revoke execute on function public.update_room_activity() from anon;
revoke execute on function public.verify_room_password(uuid, text) from anon;

-- Trigger-only helpers do not need to be exposed as RPCs to signed-in users.
revoke execute on function public.cleanup_room_characters() from authenticated;
revoke execute on function public.clear_room_password_column() from authenticated;
revoke execute on function public.delete_old_system_messages() from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.update_room_activity() from authenticated;

-- Preserve frontend-facing RPC access for signed-in users.
grant execute on function public.claim_experience(text) to authenticated;
grant execute on function public.conclude_game(uuid, jsonb) to authenticated;
grant execute on function public.handle_heartbeat() to authenticated;
grant execute on function public.set_room_password(uuid, text) to authenticated;
grant execute on function public.verify_room_password(uuid, text) to authenticated;

notify pgrst, 'reload schema';
