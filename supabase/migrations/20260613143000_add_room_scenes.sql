create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create table if not exists public.room_scenes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null,
  description text,
  background_color text not null default '#182033',
  background_pattern text not null default 'plain'
    check (background_pattern in ('plain', 'grid', 'dots', 'mist')),
  is_active boolean not null default false,
  created_by_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  check (char_length(trim(title)) > 0),
  check (char_length(title) <= 80),
  check (description is null or char_length(description) <= 800),
  check (background_color ~ '^#[0-9A-Fa-f]{6}$')
);

create table if not exists public.room_scene_markers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  scene_id uuid not null references public.room_scenes(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  x numeric(5,2) not null default 50 check (x >= 0 and x <= 100),
  y numeric(5,2) not null default 50 check (y >= 0 and y <= 100),
  is_hidden boolean not null default false,
  label text,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (scene_id, character_id),
  check (label is null or char_length(label) <= 80)
);

alter table public.room_scenes enable row level security;
alter table public.room_scene_markers enable row level security;

grant select on table public.room_scenes to authenticated;
grant select on table public.room_scene_markers to authenticated;

create unique index if not exists idx_room_scenes_one_active
  on public.room_scenes(room_id)
  where is_active;

create index if not exists idx_room_scenes_room_created
  on public.room_scenes(room_id, created_at);

create index if not exists idx_room_scene_markers_scene
  on public.room_scene_markers(scene_id);

create index if not exists idx_room_scene_markers_room
  on public.room_scene_markers(room_id);

create index if not exists idx_room_scene_markers_character
  on public.room_scene_markers(character_id);

create or replace function app_private.is_active_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = p_user_id
      and rm.status = 'active'
  );
$$;

create or replace function app_private.is_room_keeper(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rooms room
    where room.id = p_room_id
      and room.kp_id = p_user_id
  );
$$;

drop policy if exists "Active room members can view scenes" on public.room_scenes;
create policy "Active room members can view scenes"
on public.room_scenes
for select
to authenticated
using (
  app_private.is_active_room_member(room_id, (select auth.uid()))
  or app_private.is_room_keeper(room_id, (select auth.uid()))
);

drop policy if exists "Active room members can view visible markers" on public.room_scene_markers;
create policy "Active room members can view visible markers"
on public.room_scene_markers
for select
to authenticated
using (
  app_private.is_room_keeper(room_id, (select auth.uid()))
  or (
    is_hidden = false
    and app_private.is_active_room_member(room_id, (select auth.uid()))
  )
);

create or replace function app_private.validate_room_scene_character(
  p_scene_id uuid,
  p_character_id uuid
)
returns table (
  scene_id uuid,
  room_id uuid,
  character_id uuid,
  character_user_id uuid,
  character_type text
)
language sql
security definer
set search_path = public
as $$
  select
    scene.id as scene_id,
    scene.room_id,
    ch.id as character_id,
    ch.user_id as character_user_id,
    ch.type as character_type
  from public.room_scenes scene
  join public.characters ch on ch.id = p_character_id
  where scene.id = p_scene_id
    and ch.room_id = scene.room_id;
$$;

create or replace function app_private.create_room_scene(
  p_room_id uuid,
  p_title text,
  p_description text default null,
  p_background_color text default '#182033',
  p_background_pattern text default 'plain'
)
returns public.room_scenes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_scene public.room_scenes;
  v_has_scene boolean;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if not app_private.is_room_keeper(p_room_id, v_user_id) then
    raise exception 'Only the room keeper can create scenes';
  end if;

  if char_length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'Scene title is required';
  end if;

  if char_length(p_title) > 80 then
    raise exception 'Scene title is too long';
  end if;

  if p_description is not null and char_length(p_description) > 800 then
    raise exception 'Scene description is too long';
  end if;

  if coalesce(p_background_color, '') !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Invalid scene background color';
  end if;

  if p_background_pattern not in ('plain', 'grid', 'dots', 'mist') then
    raise exception 'Invalid scene background pattern';
  end if;

  select exists (
    select 1
    from public.room_scenes
    where room_id = p_room_id
  ) into v_has_scene;

  insert into public.room_scenes (
    room_id,
    title,
    description,
    background_color,
    background_pattern,
    is_active,
    created_by_user_id
  )
  values (
    p_room_id,
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    p_background_color,
    p_background_pattern,
    not v_has_scene,
    v_user_id
  )
  returning * into v_scene;

  return v_scene;
end;
$$;

create or replace function app_private.update_room_scene(
  p_scene_id uuid,
  p_title text,
  p_description text default null,
  p_background_color text default '#182033',
  p_background_pattern text default 'plain'
)
returns public.room_scenes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_scene public.room_scenes;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select room_id into v_room_id
  from public.room_scenes
  where id = p_scene_id;

  if v_room_id is null then
    raise exception 'Scene not found';
  end if;

  if not app_private.is_room_keeper(v_room_id, v_user_id) then
    raise exception 'Only the room keeper can update scenes';
  end if;

  if char_length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'Scene title is required';
  end if;

  if char_length(p_title) > 80 then
    raise exception 'Scene title is too long';
  end if;

  if p_description is not null and char_length(p_description) > 800 then
    raise exception 'Scene description is too long';
  end if;

  if coalesce(p_background_color, '') !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Invalid scene background color';
  end if;

  if p_background_pattern not in ('plain', 'grid', 'dots', 'mist') then
    raise exception 'Invalid scene background pattern';
  end if;

  update public.room_scenes
  set title = trim(p_title),
      description = nullif(trim(coalesce(p_description, '')), ''),
      background_color = p_background_color,
      background_pattern = p_background_pattern,
      updated_at = timezone('utc'::text, now())
  where id = p_scene_id
  returning * into v_scene;

  return v_scene;
end;
$$;

create or replace function app_private.set_active_room_scene(p_scene_id uuid)
returns public.room_scenes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_scene public.room_scenes;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select room_id into v_room_id
  from public.room_scenes
  where id = p_scene_id;

  if v_room_id is null then
    raise exception 'Scene not found';
  end if;

  if not app_private.is_room_keeper(v_room_id, v_user_id) then
    raise exception 'Only the room keeper can switch scenes';
  end if;

  update public.room_scenes
  set is_active = false,
      updated_at = timezone('utc'::text, now())
  where room_id = v_room_id
    and id <> p_scene_id;

  update public.room_scenes
  set is_active = true,
      updated_at = timezone('utc'::text, now())
  where id = p_scene_id
  returning * into v_scene;

  return v_scene;
end;
$$;

create or replace function app_private.delete_room_scene(p_scene_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_was_active boolean;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select room_id, is_active into v_room_id, v_was_active
  from public.room_scenes
  where id = p_scene_id;

  if v_room_id is null then
    raise exception 'Scene not found';
  end if;

  if not app_private.is_room_keeper(v_room_id, v_user_id) then
    raise exception 'Only the room keeper can delete scenes';
  end if;

  delete from public.room_scenes
  where id = p_scene_id;

  if v_was_active then
    update public.room_scenes
    set is_active = true,
        updated_at = timezone('utc'::text, now())
    where id = (
      select id
      from public.room_scenes
      where room_id = v_room_id
      order by created_at asc
      limit 1
    );
  end if;
end;
$$;

create or replace function app_private.upsert_room_scene_marker(
  p_scene_id uuid,
  p_character_id uuid,
  p_x numeric,
  p_y numeric,
  p_is_hidden boolean default false,
  p_label text default null
)
returns public.room_scene_markers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_context record;
  v_marker public.room_scene_markers;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_context
  from app_private.validate_room_scene_character(p_scene_id, p_character_id);

  if v_context.scene_id is null then
    raise exception 'Scene character is not available';
  end if;

  if not app_private.is_room_keeper(v_context.room_id, v_user_id) then
    raise exception 'Only the room keeper can manage scene markers';
  end if;

  if p_label is not null and char_length(p_label) > 80 then
    raise exception 'Scene marker label is too long';
  end if;

  insert into public.room_scene_markers (
    room_id,
    scene_id,
    character_id,
    x,
    y,
    is_hidden,
    label
  )
  values (
    v_context.room_id,
    p_scene_id,
    p_character_id,
    least(100, greatest(0, coalesce(p_x, 50))),
    least(100, greatest(0, coalesce(p_y, 50))),
    case
      when v_context.character_type = 'investigator' then false
      else coalesce(p_is_hidden, false)
    end,
    nullif(trim(coalesce(p_label, '')), '')
  )
  on conflict (scene_id, character_id) do update
  set x = excluded.x,
      y = excluded.y,
      is_hidden = excluded.is_hidden,
      label = excluded.label,
      updated_at = timezone('utc'::text, now())
  returning * into v_marker;

  return v_marker;
end;
$$;

create or replace function app_private.move_own_scene_marker(
  p_marker_id uuid,
  p_x numeric,
  p_y numeric
)
returns public.room_scene_markers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_marker_context record;
  v_marker public.room_scene_markers;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select
    marker.id,
    marker.room_id,
    ch.user_id as character_user_id,
    ch.type as character_type
  into v_marker_context
  from public.room_scene_markers marker
  join public.characters ch on ch.id = marker.character_id
  where marker.id = p_marker_id
    and ch.room_id = marker.room_id;

  if v_marker_context.id is null then
    raise exception 'Scene marker not found';
  end if;

  if not app_private.is_active_room_member(v_marker_context.room_id, v_user_id) then
    raise exception 'Only active room members can move scene markers';
  end if;

  if v_marker_context.character_user_id <> v_user_id
     or v_marker_context.character_type <> 'investigator' then
    raise exception 'You can only move your own investigator marker';
  end if;

  update public.room_scene_markers
  set x = least(100, greatest(0, coalesce(p_x, 50))),
      y = least(100, greatest(0, coalesce(p_y, 50))),
      updated_at = timezone('utc'::text, now())
  where id = p_marker_id
  returning * into v_marker;

  return v_marker;
end;
$$;

create or replace function app_private.delete_room_scene_marker(p_marker_id uuid)
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
  from public.room_scene_markers
  where id = p_marker_id;

  if v_room_id is null then
    raise exception 'Scene marker not found';
  end if;

  if not app_private.is_room_keeper(v_room_id, v_user_id) then
    raise exception 'Only the room keeper can delete scene markers';
  end if;

  delete from public.room_scene_markers
  where id = p_marker_id;
end;
$$;

create or replace function public.create_room_scene(
  p_room_id uuid,
  p_title text,
  p_description text default null,
  p_background_color text default '#182033',
  p_background_pattern text default 'plain'
)
returns public.room_scenes
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.create_room_scene(
    p_room_id,
    p_title,
    p_description,
    p_background_color,
    p_background_pattern
  );
$$;

create or replace function public.update_room_scene(
  p_scene_id uuid,
  p_title text,
  p_description text default null,
  p_background_color text default '#182033',
  p_background_pattern text default 'plain'
)
returns public.room_scenes
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.update_room_scene(
    p_scene_id,
    p_title,
    p_description,
    p_background_color,
    p_background_pattern
  );
$$;

create or replace function public.set_active_room_scene(p_scene_id uuid)
returns public.room_scenes
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.set_active_room_scene(p_scene_id);
$$;

create or replace function public.delete_room_scene(p_scene_id uuid)
returns void
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.delete_room_scene(p_scene_id);
$$;

create or replace function public.upsert_room_scene_marker(
  p_scene_id uuid,
  p_character_id uuid,
  p_x numeric,
  p_y numeric,
  p_is_hidden boolean default false,
  p_label text default null
)
returns public.room_scene_markers
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.upsert_room_scene_marker(
    p_scene_id,
    p_character_id,
    p_x,
    p_y,
    p_is_hidden,
    p_label
  );
$$;

create or replace function public.move_own_scene_marker(
  p_marker_id uuid,
  p_x numeric,
  p_y numeric
)
returns public.room_scene_markers
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.move_own_scene_marker(p_marker_id, p_x, p_y);
$$;

create or replace function public.delete_room_scene_marker(p_marker_id uuid)
returns void
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.delete_room_scene_marker(p_marker_id);
$$;

revoke all on function app_private.is_active_room_member(uuid, uuid) from public;
revoke all on function app_private.is_room_keeper(uuid, uuid) from public;
revoke all on function app_private.validate_room_scene_character(uuid, uuid) from public;
revoke all on function app_private.create_room_scene(uuid, text, text, text, text) from public;
revoke all on function app_private.update_room_scene(uuid, text, text, text, text) from public;
revoke all on function app_private.set_active_room_scene(uuid) from public;
revoke all on function app_private.delete_room_scene(uuid) from public;
revoke all on function app_private.upsert_room_scene_marker(uuid, uuid, numeric, numeric, boolean, text) from public;
revoke all on function app_private.move_own_scene_marker(uuid, numeric, numeric) from public;
revoke all on function app_private.delete_room_scene_marker(uuid) from public;

grant execute on function app_private.is_active_room_member(uuid, uuid) to authenticated;
grant execute on function app_private.is_room_keeper(uuid, uuid) to authenticated;
grant execute on function app_private.validate_room_scene_character(uuid, uuid) to authenticated;
grant execute on function app_private.create_room_scene(uuid, text, text, text, text) to authenticated;
grant execute on function app_private.update_room_scene(uuid, text, text, text, text) to authenticated;
grant execute on function app_private.set_active_room_scene(uuid) to authenticated;
grant execute on function app_private.delete_room_scene(uuid) to authenticated;
grant execute on function app_private.upsert_room_scene_marker(uuid, uuid, numeric, numeric, boolean, text) to authenticated;
grant execute on function app_private.move_own_scene_marker(uuid, numeric, numeric) to authenticated;
grant execute on function app_private.delete_room_scene_marker(uuid) to authenticated;

revoke all on function public.create_room_scene(uuid, text, text, text, text) from public;
revoke all on function public.update_room_scene(uuid, text, text, text, text) from public;
revoke all on function public.set_active_room_scene(uuid) from public;
revoke all on function public.delete_room_scene(uuid) from public;
revoke all on function public.upsert_room_scene_marker(uuid, uuid, numeric, numeric, boolean, text) from public;
revoke all on function public.move_own_scene_marker(uuid, numeric, numeric) from public;
revoke all on function public.delete_room_scene_marker(uuid) from public;

grant execute on function public.create_room_scene(uuid, text, text, text, text) to authenticated;
grant execute on function public.update_room_scene(uuid, text, text, text, text) to authenticated;
grant execute on function public.set_active_room_scene(uuid) to authenticated;
grant execute on function public.delete_room_scene(uuid) to authenticated;
grant execute on function public.upsert_room_scene_marker(uuid, uuid, numeric, numeric, boolean, text) to authenticated;
grant execute on function public.move_own_scene_marker(uuid, numeric, numeric) to authenticated;
grant execute on function public.delete_room_scene_marker(uuid) to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  )
  and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_scenes'
  ) then
    alter publication supabase_realtime add table public.room_scenes;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  )
  and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_scene_markers'
  ) then
    alter publication supabase_realtime add table public.room_scene_markers;
  end if;
end $$;

notify pgrst, 'reload schema';
