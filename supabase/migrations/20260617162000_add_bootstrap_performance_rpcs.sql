-- Reduce high-latency round trips for the lobby, square feed, room entry, and
-- tabletop persistence paths. These RPCs intentionally preserve the public
-- frontend-facing shapes so clients can fall back to the older multi-request
-- loaders while deployments roll forward.

create index if not exists idx_posts_channel_created_at
  on public.posts(channel_id, created_at desc);

create index if not exists idx_post_comments_post_created_at
  on public.post_comments(post_id, created_at desc);

create index if not exists idx_post_likes_user_post
  on public.post_likes(user_id, post_id);

create index if not exists idx_messages_room_created_at
  on public.messages(room_id, created_at desc);

create or replace function app_private.get_lobby_catalog_bootstrap(
  p_include_private boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_rooms jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', room_row.id,
        'created_at', room_row.created_at,
        'kp_id', room_row.kp_id,
        'title', room_row.title,
        'description', room_row.description,
        'status', room_row.status,
        'room_number', room_row.room_number,
        'has_password', room_row.has_password,
        'last_active_at', room_row.last_active_at,
        'bg_music_url', room_row.bg_music_url,
        'cover_image_url', room_row.cover_image_url,
        'type', room_row.type,
        'is_music_playing', room_row.is_music_playing,
        'music_track_index', room_row.music_track_index,
        'characterCount', room_row.character_count,
        'messageCount', room_row.message_count,
        'activeMemberCount', room_row.active_member_count,
        'activeMemberIds', room_row.active_member_ids,
        'characters', jsonb_build_array(
          jsonb_build_object('count', room_row.character_count)
        ),
        'messages', jsonb_build_array(
          jsonb_build_object('count', room_row.message_count)
        )
      )
      order by coalesce(room_row.last_active_at, room_row.created_at) desc,
        room_row.created_at desc,
        room_row.id
    ),
    '[]'::jsonb
  )
  into v_rooms
  from (
    select
      room.*,
      (
        select count(*)
        from public.characters character
        where character.room_id = room.id
          and character.type = 'investigator'
      ) as character_count,
      (
        select count(*)
        from public.messages message
        where message.room_id = room.id
      ) as message_count,
      (
        select count(*)
        from public.room_members member
        where member.room_id = room.id
          and member.status = 'active'
      ) as active_member_count,
      coalesce(
        (
          select jsonb_agg(member.user_id order by member.joined_at)
          from public.room_members member
          where member.room_id = room.id
            and member.status = 'active'
        ),
        '[]'::jsonb
      ) as active_member_ids
    from public.rooms room
    where (
      p_include_private
      and v_user_id is not null
      and (
        room.status = 'open'
        or room.kp_id = v_user_id
      )
      and room.status <> 'completed'
    )
    or (
      not p_include_private
      and room.status = 'open'
    )
    order by coalesce(room.last_active_at, room.created_at) desc,
      room.created_at desc,
      room.id
    limit 80
  ) room_row;

  return jsonb_build_object('rooms', v_rooms);
end;
$$;

create or replace function public.get_lobby_catalog_bootstrap(
  p_include_private boolean default false
)
returns jsonb
language sql
security definer
set search_path = public, app_private
as $$
  select app_private.get_lobby_catalog_bootstrap(p_include_private);
$$;

create or replace function app_private.get_square_feed_bootstrap(
  p_channel_id uuid default null,
  p_limit integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(50, greatest(1, coalesce(p_limit, 30)));
  v_default_channel_id uuid;
  v_channel_id uuid;
  v_user jsonb := null;
  v_channels jsonb;
  v_posts jsonb;
begin
  select channel.id
  into v_default_channel_id
  from public.channels channel
  where coalesce(channel.is_private, false) = false
  order by
    case when channel.name = U&'\95F2\804A\5927\5385' then 0 else 1 end,
    channel.category,
    channel.created_at
  limit 1;

  v_channel_id := coalesce(p_channel_id, v_default_channel_id);

  if v_user_id is not null then
    select jsonb_build_object(
      'id', auth_user.id,
      'email', auth_user.email,
      'nickname', profile.nickname,
      'avatar_url', profile.avatar_url,
      'is_vip', coalesce(profile.is_vip, false),
      'user_code', profile.user_code,
      'bio', profile.bio,
      'created_at', profile.created_at,
      'level', profile.level,
      'experience', profile.experience
    )
    into v_user
    from auth.users auth_user
    left join public.profiles profile on profile.id = auth_user.id
    where auth_user.id = v_user_id;
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(channel) order by channel.category, channel.created_at),
    '[]'::jsonb
  )
  into v_channels
  from public.channels channel
  where coalesce(channel.is_private, false) = false;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', post_row.id,
        'channel_id', post_row.channel_id,
        'user_id', post_row.user_id,
        'title', post_row.title,
        'content', post_row.content,
        'image_url', post_row.image_url,
        'tags', post_row.tags,
        'created_at', post_row.created_at,
        'updated_at', post_row.updated_at,
        'square_post_modules', post_row.modules,
        'modules', post_row.modules,
        'profiles', post_row.author_profile,
        'like_count', post_row.like_count,
        'comment_count', post_row.comment_count,
        'is_liked', post_row.is_liked,
        'liked_by', post_row.liked_by,
        'latest_comments', post_row.latest_comments
      )
      order by post_row.created_at desc
    ),
    '[]'::jsonb
  )
  into v_posts
  from (
    select
      post.*,
      jsonb_build_object(
        'nickname', author.nickname,
        'avatar_url', author.avatar_url,
        'is_vip', coalesce(author.is_vip, false)
      ) as author_profile,
      coalesce(
        (
          select jsonb_agg(to_jsonb(module) order by module.display_order, module.created_at)
          from public.square_post_modules module
          where module.post_id = post.id
        ),
        '[]'::jsonb
      ) as modules,
      (
        select count(*)
        from public.post_likes like_row
        where like_row.post_id = post.id
      ) as like_count,
      (
        select count(*)
        from public.post_comments comment
        where comment.post_id = post.id
      ) as comment_count,
      exists (
        select 1
        from public.post_likes my_like
        where my_like.post_id = post.id
          and my_like.user_id = v_user_id
      ) as is_liked,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'nickname', liker.nickname,
              'avatar_url', liker.avatar_url,
              'is_vip', coalesce(liker.is_vip, false)
            )
            order by like_row.created_at
          )
          from public.post_likes like_row
          join public.profiles liker on liker.id = like_row.user_id
          where like_row.post_id = post.id
        ),
        '[]'::jsonb
      ) as liked_by,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', latest_comment.id,
              'post_id', latest_comment.post_id,
              'user_id', latest_comment.user_id,
              'content', latest_comment.content,
              'created_at', latest_comment.created_at,
              'quote_id', latest_comment.quote_id,
              'profiles', jsonb_build_object(
                'nickname', commenter.nickname,
                'avatar_url', commenter.avatar_url,
                'is_vip', coalesce(commenter.is_vip, false)
              )
            )
            order by latest_comment.created_at desc
          )
          from (
            select *
            from public.post_comments comment
            where comment.post_id = post.id
            order by comment.created_at desc
            limit 1
          ) latest_comment
          left join public.profiles commenter on commenter.id = latest_comment.user_id
        ),
        '[]'::jsonb
      ) as latest_comments
    from public.posts post
    left join public.profiles author on author.id = post.user_id
    where post.channel_id = v_channel_id
    order by post.created_at desc
    limit v_limit
  ) post_row;

  return jsonb_build_object(
    'current_user', v_user,
    'channels', v_channels,
    'active_channel_id', v_channel_id,
    'posts', v_posts
  );
end;
$$;

create or replace function public.get_square_feed_bootstrap(
  p_channel_id uuid default null,
  p_limit integer default 30
)
returns jsonb
language sql
security definer
set search_path = public, app_private
as $$
  select app_private.get_square_feed_bootstrap(p_channel_id, p_limit);
$$;

create or replace function app_private.map_message_row_for_client(
  p_message public.messages,
  p_current_user_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_message.id,
    'timestamp', to_char(p_message.created_at at time zone 'UTC', 'HH24:MI'),
    'createdAt', p_message.created_at,
    'userId', p_message.user_id,
    'charId', coalesce(p_message.character_id::text, 'pc'),
    'charName', coalesce(character.name, profile.nickname, 'Keeper'),
    'charRole', case
      when character.id is not null then
        coalesce(
          character.role,
          case
            when character.type = 'investigator' then U&'\8C03\67E5\5458'
            when character.type = 'monster' then U&'\602A\7269'
            else 'NPC'
          end
        )
      else 'Keeper'
    end,
    'charAvatar', case
      when character.id is not null then character.avatar_url
      else profile.avatar_url
    end,
    'type', p_message.type,
    'content', p_message.content,
    'isMine', p_message.user_id = p_current_user_id,
    'recipientId', p_message.recipient_id,
    'quote', p_message.meta->'quote'
  )
  from public.messages message_row
  left join public.characters character on character.id = p_message.character_id
  left join public.profiles profile on profile.id = p_message.user_id
  where message_row.id = p_message.id;
$$;

create or replace function app_private.get_room_session_snapshot(
  p_room_id uuid,
  p_current_user_id uuid,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(100, greatest(1, coalesce(p_limit, 50)));
  v_room jsonb;
  v_characters jsonb;
  v_members jsonb;
  v_logs jsonb;
  v_log_count integer;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if not app_private.is_room_keeper(p_room_id, v_user_id)
     and not app_private.is_active_room_member(p_room_id, v_user_id) then
    raise exception 'Not allowed to load room session';
  end if;

  select jsonb_build_object(
    'id', room.id,
    'created_at', room.created_at,
    'kp_id', room.kp_id,
    'title', room.title,
    'description', room.description,
    'status', room.status,
    'room_number', room.room_number,
    'has_password', room.has_password,
    'last_active_at', room.last_active_at,
    'bg_music_url', room.bg_music_url,
    'cover_image_url', room.cover_image_url,
    'type', room.type,
    'is_music_playing', room.is_music_playing,
    'music_track_index', room.music_track_index
  )
  into v_room
  from public.rooms room
  where room.id = p_room_id;

  select coalesce(
    jsonb_agg(to_jsonb(character) order by character.created_at),
    '[]'::jsonb
  )
  into v_characters
  from public.characters character
  where character.room_id = p_room_id;

  select coalesce(
    jsonb_agg(to_jsonb(member) order by member.role, member.joined_at),
    '[]'::jsonb
  )
  into v_members
  from public.room_members member
  where member.room_id = p_room_id;

  with latest_messages as (
    select message.*
    from public.messages message
    where message.room_id = p_room_id
      and (
        message.recipient_id is null
        or message.user_id = v_user_id
        or message.recipient_id = v_user_id
        or app_private.is_room_keeper(p_room_id, v_user_id)
      )
    order by message.created_at desc
    limit v_limit
  ),
  ordered_messages as (
    select *
    from latest_messages
    order by created_at asc
  )
  select
    coalesce(
      jsonb_agg(app_private.map_message_row_for_client(ordered_messages, p_current_user_id)),
      '[]'::jsonb
    ),
    count(*)
  into v_logs, v_log_count
  from ordered_messages;

  return jsonb_build_object(
    'room', v_room,
    'characters', v_characters,
    'room_members', v_members,
    'logs', v_logs,
    'has_more_logs', v_log_count = v_limit
  );
end;
$$;

create or replace function public.join_room_session_bootstrap(
  p_room_id uuid,
  p_character_id uuid default null,
  p_password text default null,
  p_invitation_id uuid default null,
  p_invite_token text default null,
  p_page_size integer default 50
)
returns jsonb
language plpgsql
security invoker
set search_path = public, app_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_membership public.room_members;
  v_snapshot jsonb;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if p_invitation_id is not null then
    v_membership := app_private.accept_room_invitation(
      p_invitation_id,
      p_character_id
    );
  elsif p_invite_token is not null then
    v_membership := app_private.accept_room_invite_link(
      p_invite_token,
      p_character_id
    );
  else
    v_membership := app_private.join_room(
      p_room_id,
      p_character_id,
      p_password
    );
  end if;

  v_snapshot := app_private.get_room_session_snapshot(
    coalesce(v_membership.room_id, p_room_id),
    v_user_id,
    p_page_size
  );

  return v_snapshot || jsonb_build_object(
    'membership',
    to_jsonb(v_membership),
    'user_id',
    v_user_id,
    'user_nickname',
    (
      select profile.nickname
      from public.profiles profile
      where profile.id = v_user_id
    )
  );
end;
$$;

create or replace function app_private.persist_room_tabletop_update_batch(
  p_room_id uuid,
  p_client_id text,
  p_updates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_document public.room_tabletop_documents;
  v_documents jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if not app_private.is_room_keeper(p_room_id, v_user_id) then
    raise exception 'Only the room keeper can persist tabletop documents';
  end if;

  if jsonb_typeof(coalesce(p_updates, '[]'::jsonb)) <> 'array' then
    raise exception 'Invalid tabletop update batch';
  end if;

  for v_item in
    select value from jsonb_array_elements(p_updates)
  loop
    select *
    into v_document
    from app_private.persist_room_tabletop_update(
      p_room_id,
      v_item->>'scope',
      p_client_id,
      coalesce(v_item->>'update_base64', v_item->>'snapshot_base64', ''),
      coalesce(v_item->>'snapshot_base64', ''),
      coalesce(v_item->'state_json', '{}'::jsonb)
    );

    v_documents := v_documents || jsonb_build_array(to_jsonb(v_document));
  end loop;

  return jsonb_build_object('documents', v_documents);
end;
$$;

create or replace function public.persist_room_tabletop_update_batch(
  p_room_id uuid,
  p_client_id text,
  p_updates jsonb
)
returns jsonb
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.persist_room_tabletop_update_batch(
    p_room_id,
    p_client_id,
    p_updates
  );
$$;

revoke all on function app_private.get_lobby_catalog_bootstrap(boolean) from public;
revoke all on function app_private.get_square_feed_bootstrap(uuid, integer) from public;
revoke all on function app_private.map_message_row_for_client(public.messages, uuid) from public;
revoke all on function app_private.get_room_session_snapshot(uuid, uuid, integer) from public;
revoke all on function app_private.persist_room_tabletop_update_batch(uuid, text, jsonb) from public;

revoke all on function public.get_lobby_catalog_bootstrap(boolean) from public;
revoke all on function public.get_square_feed_bootstrap(uuid, integer) from public;
revoke all on function public.join_room_session_bootstrap(uuid, uuid, text, uuid, text, integer) from public;
revoke all on function public.persist_room_tabletop_update_batch(uuid, text, jsonb) from public;

grant execute on function public.get_lobby_catalog_bootstrap(boolean) to anon, authenticated;
grant execute on function public.get_square_feed_bootstrap(uuid, integer) to anon, authenticated;
grant execute on function public.join_room_session_bootstrap(uuid, uuid, text, uuid, text, integer) to authenticated;
grant execute on function public.persist_room_tabletop_update_batch(uuid, text, jsonb) to authenticated;

grant execute on function app_private.get_lobby_catalog_bootstrap(boolean) to authenticated;
grant execute on function app_private.get_square_feed_bootstrap(uuid, integer) to authenticated;
grant execute on function app_private.get_room_session_snapshot(uuid, uuid, integer) to authenticated;
grant execute on function app_private.persist_room_tabletop_update_batch(uuid, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
