create or replace function app_private.project_tabletop_state_for_players(
  p_state jsonb
)
returns jsonb
language sql
stable
as $$
  select jsonb_set(
    coalesce(p_state, '{}'::jsonb),
    '{scenes}',
    coalesce(
      (
        select jsonb_agg(
          jsonb_set(
            scene,
            '{map,tiles}',
            coalesce(
              (
                select jsonb_agg(
                  case
                    when coalesce((tile->>'revealed')::boolean, false)
                      then tile
                    else tile
                      || jsonb_build_object('kind', 'wall')
                      - 'roomId'
                  end
                  order by tile_ordinality
                )
                from jsonb_array_elements(coalesce(scene->'map'->'tiles', '[]'::jsonb))
                  with ordinality as tile_item(tile, tile_ordinality)
              ),
              '[]'::jsonb
            ),
            true
          )
          order by scene_ordinality
        )
        from jsonb_array_elements(coalesce(p_state->'scenes', '[]'::jsonb))
          with ordinality as scene_item(scene, scene_ordinality)
      ),
      '[]'::jsonb
    ),
    true
  );
$$;

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
  v_tabletop_state jsonb;
  v_public_tabletop_state jsonb;
  v_has_tabletop_state boolean := false;
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

    if v_scene.tabletop_state is not null and jsonb_typeof(v_scene.tabletop_state) = 'object' then
      v_has_tabletop_state := true;
      if v_tabletop_state is null then
        v_tabletop_state := jsonb_build_object(
          'roomId', p_room_id::text,
          'activeSceneId', v_new_scene_id::text,
          'scenes', '[]'::jsonb,
          'tokens', '[]'::jsonb,
          'shapes', '[]'::jsonb,
          'fogRegions', coalesce(v_scene.tabletop_state->'fogRegions', '[]'::jsonb),
          'updatedAt', timezone('utc'::text, now())::text
        );
      end if;

      v_tabletop_state := jsonb_set(
        v_tabletop_state,
        '{scenes}',
        coalesce(v_tabletop_state->'scenes', '[]'::jsonb) ||
          jsonb_build_array(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    coalesce(v_scene.tabletop_state->'scenes'->0, '{}'::jsonb),
                    '{id}',
                    to_jsonb(v_new_scene_id::text),
                    true
                  ),
                  '{title}',
                  to_jsonb(v_scene.title),
                  true
                ),
                '{description}',
                to_jsonb(v_scene.description),
                true
              ),
              '{updatedAt}',
              to_jsonb(timezone('utc'::text, now())::text),
              true
            )
          ),
        true
      );

      v_tabletop_state := jsonb_set(
        v_tabletop_state,
        '{shapes}',
        coalesce(v_tabletop_state->'shapes', '[]'::jsonb) ||
          (
            select coalesce(
              jsonb_agg(shape || jsonb_build_object('sceneId', v_new_scene_id::text)),
              '[]'::jsonb
            )
            from jsonb_array_elements(coalesce(v_scene.tabletop_state->'shapes', '[]'::jsonb)) shape
          ),
        true
      );
    end if;

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

  if v_has_tabletop_state and v_tabletop_state is not null then
    v_public_tabletop_state := app_private.project_tabletop_state_for_players(v_tabletop_state);

    insert into public.room_tabletop_documents (
      room_id,
      scope,
      snapshot_base64,
      state_json,
      version,
      updated_by_user_id,
      updated_at
    )
    values (
      p_room_id,
      'keeper',
      null,
      v_tabletop_state,
      1,
      v_user_id,
      timezone('utc'::text, now())
    )
    on conflict (room_id, scope) do update
    set snapshot_base64 = excluded.snapshot_base64,
        state_json = excluded.state_json,
        version = room_tabletop_documents.version + 1,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = excluded.updated_at;

    insert into public.room_tabletop_documents (
      room_id,
      scope,
      snapshot_base64,
      state_json,
      version,
      updated_by_user_id,
      updated_at
    )
    values (
      p_room_id,
      'public',
      null,
      v_public_tabletop_state,
      1,
      v_user_id,
      timezone('utc'::text, now())
    )
    on conflict (room_id, scope) do update
    set snapshot_base64 = excluded.snapshot_base64,
        state_json = excluded.state_json,
        version = room_tabletop_documents.version + 1,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = excluded.updated_at;
  end if;
end;
$$;

revoke all on function app_private.project_tabletop_state_for_players(jsonb) from public;
revoke all on function app_private.copy_module_template_scenes_to_room(uuid, uuid) from public;
grant execute on function app_private.project_tabletop_state_for_players(jsonb) to authenticated;
grant execute on function app_private.copy_module_template_scenes_to_room(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
