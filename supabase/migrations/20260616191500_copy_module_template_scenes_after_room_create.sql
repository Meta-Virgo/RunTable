create or replace function app_private.copy_module_template_scenes_to_room(
  p_template_id uuid,
  p_room_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_scene record;
  v_marker jsonb;
  v_new_scene_id uuid;
  v_character_map jsonb := '{}'::jsonb;
  v_marker_character_id uuid;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if not exists (
    select 1
    from public.rooms room
    where room.id = p_room_id
      and room.kp_id = v_user_id
  ) then
    raise exception 'Only the room keeper can copy module scenes';
  end if;

  if exists (select 1 from public.room_scenes where room_id = p_room_id) then
    return;
  end if;

  select coalesce(
    jsonb_object_agg(template_character_key, character_id),
    '{}'::jsonb
  )
  into v_character_map
  from (
    select distinct on (template_character.template_character_key)
      template_character.template_character_key,
      character.id as character_id
    from public.module_template_characters template_character
    join public.characters character
      on character.room_id = p_room_id
      and character.type = template_character.character_type
      and character.name = coalesce(
        nullif(template_character.payload->>'name', ''),
        template_character.template_character_key
      )
    where template_character.template_id = p_template_id
      and template_character.character_type in ('npc', 'monster')
    order by template_character.template_character_key, character.created_at
  ) mapped_characters;

  for v_scene in
    select *
    from public.module_template_scenes
    where template_id = p_template_id
    order by display_order, created_at
  loop
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
      v_scene.title,
      v_scene.description,
      v_scene.background_color,
      v_scene.background_pattern,
      v_scene.is_default,
      v_user_id
    )
    returning id into v_new_scene_id;

    for v_marker in
      select value
      from jsonb_array_elements(coalesce(v_scene.marker_payload, '[]'::jsonb))
    loop
      v_marker_character_id := nullif(
        v_character_map->>(v_marker->>'character_key'),
        ''
      )::uuid;

      if v_marker_character_id is not null then
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
          p_room_id,
          v_new_scene_id,
          v_marker_character_id,
          least(100, greatest(0, coalesce((v_marker->>'x')::numeric, 50))),
          least(100, greatest(0, coalesce((v_marker->>'y')::numeric, 50))),
          coalesce((v_marker->>'is_hidden')::boolean, true),
          nullif(v_marker->>'label', '')
        )
        on conflict (scene_id, character_id) do nothing;
      end if;
    end loop;
  end loop;

  if not exists (
    select 1 from public.room_scenes where room_id = p_room_id and is_active
  ) then
    update public.room_scenes
    set is_active = true,
        updated_at = timezone('utc'::text, now())
    where id = (
      select id
      from public.room_scenes
      where room_id = p_room_id
      order by created_at asc
      limit 1
    );
  end if;
end;
$$;

create or replace function public.create_room_from_module_template(
  p_template_id uuid,
  p_title text default null,
  p_room_type text default 'text',
  p_password text default null,
  p_cover_image_url text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, app_private
as $$
declare
  v_room_id uuid;
begin
  v_room_id := app_private.create_room_from_module_template(
    p_template_id,
    p_title,
    p_room_type,
    p_password,
    p_cover_image_url
  );

  perform app_private.copy_module_template_scenes_to_room(
    p_template_id,
    v_room_id
  );

  return v_room_id;
end;
$$;

revoke all on function app_private.copy_module_template_scenes_to_room(uuid, uuid) from public;
revoke all on function public.create_room_from_module_template(uuid, text, text, text, text) from public;
grant execute on function app_private.copy_module_template_scenes_to_room(uuid, uuid) to authenticated;
grant execute on function public.create_room_from_module_template(uuid, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
