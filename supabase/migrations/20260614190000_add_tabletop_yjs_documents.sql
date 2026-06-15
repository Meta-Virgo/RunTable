create table if not exists public.room_tabletop_documents (
  room_id uuid not null references public.rooms(id) on delete cascade,
  scope text not null check (scope in ('keeper', 'public')),
  snapshot_base64 text,
  state_json jsonb,
  last_update_id bigint not null default 0,
  version bigint not null default 0,
  updated_by_user_id uuid references public.profiles(id) on delete set null,
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  primary key (room_id, scope)
);

create table if not exists public.room_tabletop_updates (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  scope text not null check (scope in ('keeper', 'public')),
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  client_id text not null,
  update_base64 text not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.room_tabletop_tokens (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  scene_id uuid not null,
  character_id uuid not null references public.characters(id) on delete cascade,
  x numeric(12, 2) not null default 0,
  y numeric(12, 2) not null default 0,
  size numeric(8, 2) not null default 42,
  rotation numeric(8, 2) not null default 0,
  z_index integer not null default 1,
  is_hidden boolean not null default false,
  is_locked boolean not null default false,
  label text,
  updated_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (room_id, scene_id, character_id),
  check (x >= 0),
  check (y >= 0),
  check (size >= 12 and size <= 180),
  check (label is null or char_length(label) <= 80)
);

alter table public.room_tabletop_documents enable row level security;
alter table public.room_tabletop_updates enable row level security;
alter table public.room_tabletop_tokens enable row level security;

grant select on table public.room_tabletop_documents to authenticated;
grant select on table public.room_tabletop_updates to authenticated;
grant select on table public.room_tabletop_tokens to authenticated;

create index if not exists idx_room_tabletop_updates_room_scope_id
  on public.room_tabletop_updates(room_id, scope, id);

create index if not exists idx_room_tabletop_tokens_room_scene
  on public.room_tabletop_tokens(room_id, scene_id);

create index if not exists idx_room_tabletop_tokens_character
  on public.room_tabletop_tokens(character_id);

drop policy if exists "Members can read allowed tabletop docs"
  on public.room_tabletop_documents;
create policy "Members can read allowed tabletop docs"
on public.room_tabletop_documents
for select
to authenticated
using (
  app_private.is_room_keeper(room_id, (select auth.uid()))
  or (
    scope = 'public'
    and app_private.is_active_room_member(room_id, (select auth.uid()))
  )
);

drop policy if exists "Members can read allowed tabletop updates"
  on public.room_tabletop_updates;
create policy "Members can read allowed tabletop updates"
on public.room_tabletop_updates
for select
to authenticated
using (
  app_private.is_room_keeper(room_id, (select auth.uid()))
  or (
    scope = 'public'
    and app_private.is_active_room_member(room_id, (select auth.uid()))
  )
);

drop policy if exists "Members can read visible tabletop tokens"
  on public.room_tabletop_tokens;
create policy "Members can read visible tabletop tokens"
on public.room_tabletop_tokens
for select
to authenticated
using (
  app_private.is_room_keeper(room_id, (select auth.uid()))
  or (
    is_hidden = false
    and app_private.is_active_room_member(room_id, (select auth.uid()))
  )
);

create or replace function app_private.get_room_id_from_tabletop_doc_topic(
  p_topic text
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_topic ~ '^tabletop-doc:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:(keeper|public)$'
      then split_part(p_topic, ':', 2)::uuid
    else null
  end;
$$;

create or replace function app_private.get_scope_from_tabletop_doc_topic(
  p_topic text
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_topic ~ '^tabletop-doc:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:(keeper|public)$'
      then split_part(p_topic, ':', 3)
    else null
  end;
$$;

create or replace function app_private.can_access_tabletop_doc_topic(
  p_topic text,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    where app_private.get_room_id_from_tabletop_doc_topic(p_topic) is not null
      and (
        app_private.is_room_keeper(
          app_private.get_room_id_from_tabletop_doc_topic(p_topic),
          p_user_id
        )
        or (
          app_private.get_scope_from_tabletop_doc_topic(p_topic) = 'public'
          and app_private.is_active_room_member(
            app_private.get_room_id_from_tabletop_doc_topic(p_topic),
            p_user_id
          )
        )
      )
  );
$$;

create or replace function app_private.can_send_tabletop_doc_topic(
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
  select exists (
    select 1
    where app_private.can_access_tabletop_doc_topic(p_topic, p_user_id)
      and (
        app_private.is_room_keeper(
          app_private.get_room_id_from_tabletop_doc_topic(p_topic),
          p_user_id
        )
        or (
          app_private.get_scope_from_tabletop_doc_topic(p_topic) = 'public'
          and p_payload->>'updateBase64' is null
        )
      )
  );
$$;

drop policy if exists "Authorized users can receive tabletop broadcasts"
  on realtime.messages;
create policy "Authorized users can receive tabletop broadcasts"
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and app_private.can_access_tabletop_doc_topic(
    (select realtime.topic()),
    (select auth.uid())
  )
);

drop policy if exists "Authorized users can send tabletop broadcasts"
  on realtime.messages;
create policy "Authorized users can send tabletop broadcasts"
on realtime.messages
for insert
to authenticated
with check (
  extension = 'broadcast'
  and event = 'tabletop-y-update'
  and app_private.can_send_tabletop_doc_topic(
    (select realtime.topic()),
    payload,
    (select auth.uid())
  )
);

create or replace function app_private.get_room_tabletop_bootstrap(
  p_room_id uuid,
  p_scope text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_document public.room_tabletop_documents;
  v_updates jsonb;
  v_tokens jsonb;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if p_scope not in ('keeper', 'public') then
    raise exception 'Invalid tabletop scope';
  end if;

  if not app_private.is_room_keeper(p_room_id, v_user_id)
     and not (p_scope = 'public' and app_private.is_active_room_member(p_room_id, v_user_id)) then
    raise exception 'Not allowed to load tabletop state';
  end if;

  select * into v_document
  from public.room_tabletop_documents
  where room_id = p_room_id
    and scope = p_scope;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', room_tabletop_updates.id,
        'update_base64', room_tabletop_updates.update_base64,
        'created_at', room_tabletop_updates.created_at
      )
      order by room_tabletop_updates.id
    ),
    '[]'::jsonb
  ) into v_updates
  from public.room_tabletop_updates
  where room_id = p_room_id
    and scope = p_scope
    and id > coalesce(v_document.last_update_id, 0);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', token.id,
        'roomId', token.room_id,
        'sceneId', token.scene_id,
        'characterId', token.character_id,
        'x', token.x,
        'y', token.y,
        'size', token.size,
        'rotation', token.rotation,
        'zIndex', token.z_index,
        'isHidden', token.is_hidden,
        'isLocked', token.is_locked,
        'label', token.label,
        'updatedAt', token.updated_at
      )
      order by token.z_index, token.created_at
    ),
    '[]'::jsonb
  ) into v_tokens
  from public.room_tabletop_tokens token
  where token.room_id = p_room_id
    and (
      app_private.is_room_keeper(p_room_id, v_user_id)
      or token.is_hidden = false
    );

  return jsonb_build_object(
    'room_id', p_room_id,
    'scope', p_scope,
    'snapshot_base64', v_document.snapshot_base64,
    'state_json', v_document.state_json,
    'last_update_id', coalesce(v_document.last_update_id, 0),
    'version', coalesce(v_document.version, 0),
    'updates', v_updates,
    'tokens', v_tokens
  );
end;
$$;

create or replace function app_private.persist_room_tabletop_update(
  p_room_id uuid,
  p_scope text,
  p_client_id text,
  p_update_base64 text,
  p_snapshot_base64 text,
  p_state_json jsonb
)
returns public.room_tabletop_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_update_id bigint;
  v_document public.room_tabletop_documents;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if p_scope not in ('keeper', 'public') then
    raise exception 'Invalid tabletop scope';
  end if;

  if not app_private.is_room_keeper(p_room_id, v_user_id) then
    raise exception 'Only the room keeper can persist tabletop documents';
  end if;

  insert into public.room_tabletop_updates (
    room_id,
    scope,
    actor_user_id,
    client_id,
    update_base64
  )
  values (
    p_room_id,
    p_scope,
    v_user_id,
    p_client_id,
    p_update_base64
  )
  returning id into v_update_id;

  insert into public.room_tabletop_documents (
    room_id,
    scope,
    snapshot_base64,
    state_json,
    last_update_id,
    version,
    updated_by_user_id,
    updated_at
  )
  values (
    p_room_id,
    p_scope,
    p_snapshot_base64,
    p_state_json,
    v_update_id,
    1,
    v_user_id,
    timezone('utc'::text, now())
  )
  on conflict (room_id, scope) do update
  set snapshot_base64 = excluded.snapshot_base64,
      state_json = excluded.state_json,
      last_update_id = excluded.last_update_id,
      version = room_tabletop_documents.version + 1,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = excluded.updated_at
  returning * into v_document;

  return v_document;
end;
$$;

create or replace function app_private.map_tabletop_token_row(
  p_token public.room_tabletop_tokens
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_token.id,
    'roomId', p_token.room_id,
    'sceneId', p_token.scene_id,
    'characterId', p_token.character_id,
    'x', p_token.x,
    'y', p_token.y,
    'size', p_token.size,
    'rotation', p_token.rotation,
    'zIndex', p_token.z_index,
    'isHidden', p_token.is_hidden,
    'isLocked', p_token.is_locked,
    'label', p_token.label,
    'updatedAt', p_token.updated_at
  );
$$;

create or replace function app_private.upsert_tabletop_token(
  p_room_id uuid,
  p_scene_id uuid,
  p_character_id uuid,
  p_x numeric,
  p_y numeric,
  p_size numeric default 42,
  p_rotation numeric default 0,
  p_z_index integer default 1,
  p_is_hidden boolean default false,
  p_is_locked boolean default false,
  p_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_character public.characters;
  v_token public.room_tabletop_tokens;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if not app_private.is_room_keeper(p_room_id, v_user_id) then
    raise exception 'Only the room keeper can manage tabletop tokens';
  end if;

  select * into v_character
  from public.characters
  where id = p_character_id
    and room_id = p_room_id;

  if v_character.id is null then
    raise exception 'Character is not in this room';
  end if;

  insert into public.room_tabletop_tokens (
    room_id,
    scene_id,
    character_id,
    x,
    y,
    size,
    rotation,
    z_index,
    is_hidden,
    is_locked,
    label,
    updated_by_user_id
  )
  values (
    p_room_id,
    p_scene_id,
    p_character_id,
    greatest(0, coalesce(p_x, 0)),
    greatest(0, coalesce(p_y, 0)),
    least(180, greatest(12, coalesce(p_size, 42))),
    coalesce(p_rotation, 0),
    coalesce(p_z_index, 1),
    case when v_character.type = 'investigator' then false else coalesce(p_is_hidden, false) end,
    coalesce(p_is_locked, false),
    nullif(trim(coalesce(p_label, '')), ''),
    v_user_id
  )
  on conflict (room_id, scene_id, character_id) do update
  set x = excluded.x,
      y = excluded.y,
      size = excluded.size,
      rotation = excluded.rotation,
      z_index = excluded.z_index,
      is_hidden = excluded.is_hidden,
      is_locked = excluded.is_locked,
      label = excluded.label,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = timezone('utc'::text, now())
  returning * into v_token;

  return app_private.map_tabletop_token_row(v_token);
end;
$$;

create or replace function app_private.move_tabletop_token(
  p_token_id uuid,
  p_x numeric,
  p_y numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_context record;
  v_token public.room_tabletop_tokens;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select
    token.id,
    token.room_id,
    token.is_hidden,
    token.is_locked,
    character.user_id as character_user_id,
    character.type as character_type
  into v_context
  from public.room_tabletop_tokens token
  join public.characters character
    on character.id = token.character_id
   and character.room_id = token.room_id
  where token.id = p_token_id;

  if v_context.id is null then
    raise exception 'Token not found';
  end if;

  if not app_private.is_room_keeper(v_context.room_id, v_user_id) then
    if not app_private.is_active_room_member(v_context.room_id, v_user_id) then
      raise exception 'Only active room members can move tabletop tokens';
    end if;
    if v_context.is_hidden or v_context.is_locked then
      raise exception 'This token cannot be moved by players';
    end if;
    if v_context.character_user_id <> v_user_id
       or v_context.character_type <> 'investigator' then
      raise exception 'You can only move your own investigator token';
    end if;
  end if;

  update public.room_tabletop_tokens
  set x = greatest(0, coalesce(p_x, 0)),
      y = greatest(0, coalesce(p_y, 0)),
      updated_by_user_id = v_user_id,
      updated_at = timezone('utc'::text, now())
  where id = p_token_id
  returning * into v_token;

  return app_private.map_tabletop_token_row(v_token);
end;
$$;

create or replace function app_private.delete_tabletop_token(p_token_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select room_id into v_room_id
  from public.room_tabletop_tokens
  where id = p_token_id;

  if v_room_id is null then
    raise exception 'Token not found';
  end if;

  if not app_private.is_room_keeper(v_room_id, v_user_id) then
    raise exception 'Only the room keeper can delete tabletop tokens';
  end if;

  delete from public.room_tabletop_tokens
  where id = p_token_id;
end;
$$;

create or replace function app_private.set_active_tabletop_scene(
  p_room_id uuid,
  p_scene_id uuid,
  p_state_json jsonb,
  p_snapshot_base64 text
)
returns public.room_tabletop_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_document public.room_tabletop_documents;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if not app_private.is_room_keeper(p_room_id, v_user_id) then
    raise exception 'Only the room keeper can switch tabletop scenes';
  end if;

  insert into public.room_tabletop_documents (
    room_id,
    scope,
    snapshot_base64,
    state_json,
    updated_by_user_id,
    updated_at
  )
  values (
    p_room_id,
    'keeper',
    p_snapshot_base64,
    p_state_json,
    v_user_id,
    timezone('utc'::text, now())
  )
  on conflict (room_id, scope) do update
  set snapshot_base64 = excluded.snapshot_base64,
      state_json = excluded.state_json,
      version = room_tabletop_documents.version + 1,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = excluded.updated_at
  returning * into v_document;

  return v_document;
end;
$$;

create or replace function public.get_room_tabletop_bootstrap(
  p_room_id uuid,
  p_scope text
)
returns jsonb
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.get_room_tabletop_bootstrap(p_room_id, p_scope);
$$;

create or replace function public.persist_room_tabletop_update(
  p_room_id uuid,
  p_scope text,
  p_client_id text,
  p_update_base64 text,
  p_snapshot_base64 text,
  p_state_json jsonb
)
returns public.room_tabletop_documents
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.persist_room_tabletop_update(
    p_room_id,
    p_scope,
    p_client_id,
    p_update_base64,
    p_snapshot_base64,
    p_state_json
  );
$$;

create or replace function public.upsert_tabletop_token(
  p_room_id uuid,
  p_scene_id uuid,
  p_character_id uuid,
  p_x numeric,
  p_y numeric,
  p_size numeric default 42,
  p_rotation numeric default 0,
  p_z_index integer default 1,
  p_is_hidden boolean default false,
  p_is_locked boolean default false,
  p_label text default null
)
returns jsonb
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.upsert_tabletop_token(
    p_room_id,
    p_scene_id,
    p_character_id,
    p_x,
    p_y,
    p_size,
    p_rotation,
    p_z_index,
    p_is_hidden,
    p_is_locked,
    p_label
  );
$$;

create or replace function public.move_tabletop_token(
  p_token_id uuid,
  p_x numeric,
  p_y numeric
)
returns jsonb
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.move_tabletop_token(p_token_id, p_x, p_y);
$$;

create or replace function public.delete_tabletop_token(p_token_id uuid)
returns void
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.delete_tabletop_token(p_token_id);
$$;

create or replace function public.set_active_tabletop_scene(
  p_room_id uuid,
  p_scene_id uuid,
  p_state_json jsonb,
  p_snapshot_base64 text
)
returns public.room_tabletop_documents
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.set_active_tabletop_scene(
    p_room_id,
    p_scene_id,
    p_state_json,
    p_snapshot_base64
  );
$$;

revoke all on function app_private.get_room_id_from_tabletop_doc_topic(text) from public;
revoke all on function app_private.get_scope_from_tabletop_doc_topic(text) from public;
revoke all on function app_private.can_access_tabletop_doc_topic(text, uuid) from public;
revoke all on function app_private.can_send_tabletop_doc_topic(text, jsonb, uuid) from public;
revoke all on function app_private.get_room_tabletop_bootstrap(uuid, text) from public;
revoke all on function app_private.persist_room_tabletop_update(uuid, text, text, text, text, jsonb) from public;
revoke all on function app_private.map_tabletop_token_row(public.room_tabletop_tokens) from public;
revoke all on function app_private.upsert_tabletop_token(uuid, uuid, uuid, numeric, numeric, numeric, numeric, integer, boolean, boolean, text) from public;
revoke all on function app_private.move_tabletop_token(uuid, numeric, numeric) from public;
revoke all on function app_private.delete_tabletop_token(uuid) from public;
revoke all on function app_private.set_active_tabletop_scene(uuid, uuid, jsonb, text) from public;

grant execute on function app_private.get_room_id_from_tabletop_doc_topic(text) to authenticated;
grant execute on function app_private.get_scope_from_tabletop_doc_topic(text) to authenticated;
grant execute on function app_private.can_access_tabletop_doc_topic(text, uuid) to authenticated;
grant execute on function app_private.can_send_tabletop_doc_topic(text, jsonb, uuid) to authenticated;
grant execute on function app_private.get_room_tabletop_bootstrap(uuid, text) to authenticated;
grant execute on function app_private.persist_room_tabletop_update(uuid, text, text, text, text, jsonb) to authenticated;
grant execute on function app_private.map_tabletop_token_row(public.room_tabletop_tokens) to authenticated;
grant execute on function app_private.upsert_tabletop_token(uuid, uuid, uuid, numeric, numeric, numeric, numeric, integer, boolean, boolean, text) to authenticated;
grant execute on function app_private.move_tabletop_token(uuid, numeric, numeric) to authenticated;
grant execute on function app_private.delete_tabletop_token(uuid) to authenticated;
grant execute on function app_private.set_active_tabletop_scene(uuid, uuid, jsonb, text) to authenticated;

revoke all on function public.get_room_tabletop_bootstrap(uuid, text) from public;
revoke all on function public.persist_room_tabletop_update(uuid, text, text, text, text, jsonb) from public;
revoke all on function public.upsert_tabletop_token(uuid, uuid, uuid, numeric, numeric, numeric, numeric, integer, boolean, boolean, text) from public;
revoke all on function public.move_tabletop_token(uuid, numeric, numeric) from public;
revoke all on function public.delete_tabletop_token(uuid) from public;
revoke all on function public.set_active_tabletop_scene(uuid, uuid, jsonb, text) from public;

grant execute on function public.get_room_tabletop_bootstrap(uuid, text) to authenticated;
grant execute on function public.persist_room_tabletop_update(uuid, text, text, text, text, jsonb) to authenticated;
grant execute on function public.upsert_tabletop_token(uuid, uuid, uuid, numeric, numeric, numeric, numeric, integer, boolean, boolean, text) to authenticated;
grant execute on function public.move_tabletop_token(uuid, numeric, numeric) to authenticated;
grant execute on function public.delete_tabletop_token(uuid) to authenticated;
grant execute on function public.set_active_tabletop_scene(uuid, uuid, jsonb, text) to authenticated;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  )
  and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_tabletop_tokens'
  ) then
    alter publication supabase_realtime add table public.room_tabletop_tokens;
  end if;
end $$;

notify pgrst, 'reload schema';
