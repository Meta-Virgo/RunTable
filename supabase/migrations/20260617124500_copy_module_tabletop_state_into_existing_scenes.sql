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
  v_room_scene_id uuid;
  v_scene_index integer := 0;
  v_character_map jsonb := '{}'::jsonb;
  v_scene_id_map jsonb := '{}'::jsonb;
  v_marker_character_id uuid;
  v_tabletop_state jsonb;
  v_public_tabletop_state jsonb;
  v_has_tabletop_state boolean := false;
  v_active_scene_id uuid;
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
    v_scene_index := v_scene_index + 1;
    v_room_scene_id := null;

    select existing_scene.id
    into v_room_scene_id
    from (
      select
        room_scene.id,
        room_scene.title,
        room_scene.created_at,
        row_number() over (order by room_scene.created_at asc, room_scene.id asc) as ordinal
      from public.room_scenes room_scene
      where room_scene.room_id = p_room_id
    ) existing_scene
    where existing_scene.ordinal = v_scene_index
       or existing_scene.title = v_scene.title
    order by
      case when existing_scene.ordinal = v_scene_index then 0 else 1 end,
      existing_scene.created_at asc
    limit 1;

    if v_room_scene_id is null then
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
        v_scene.is_default
          and not exists (
            select 1
            from public.room_scenes
            where room_id = p_room_id
              and is_active
          ),
        v_user_id
      )
      returning id into v_room_scene_id;
    else
      update public.room_scenes
      set title = v_scene.title,
          description = v_scene.description,
          background_color = v_scene.background_color,
          background_pattern = v_scene.background_pattern,
          updated_at = timezone('utc'::text, now())
      where id = v_room_scene_id;
    end if;

    v_scene_id_map := v_scene_id_map
      || jsonb_build_object(v_scene.id::text, v_room_scene_id::text);

    if v_scene.tabletop_state is not null and jsonb_typeof(v_scene.tabletop_state) = 'object' then
      v_has_tabletop_state := true;
      if v_tabletop_state is null then
        v_active_scene_id := v_room_scene_id;
        if (v_scene.tabletop_state->>'activeSceneId') is not null then
          v_active_scene_id := coalesce(
            nullif(v_scene_id_map->>(v_scene.tabletop_state->>'activeSceneId'), '')::uuid,
            v_room_scene_id
          );
        end if;

        v_tabletop_state := jsonb_build_object(
          'roomId', p_room_id::text,
          'activeSceneId', v_active_scene_id::text,
          'scenes', '[]'::jsonb,
          'tokens', '[]'::jsonb,
          'shapes', '[]'::jsonb,
          'fogRegions', '[]'::jsonb,
          'updatedAt', timezone('utc'::text, now())::text
        );
      end if;

      v_tabletop_state := jsonb_set(
        v_tabletop_state,
        '{scenes}',
        coalesce(v_tabletop_state->'scenes', '[]'::jsonb) ||
          (
            select coalesce(
              jsonb_agg(
                scene_item.scene
                || jsonb_build_object(
                  'id',
                  coalesce(
                    nullif(v_scene_id_map->>(scene_item.scene->>'id'), ''),
                    v_room_scene_id::text
                  ),
                  'title',
                  case
                    when scene_item.scene->>'id' = coalesce(v_scene.tabletop_state->>'activeSceneId', scene_item.scene->>'id')
                      then v_scene.title
                    else coalesce(scene_item.scene->>'title', v_scene.title)
                  end,
                  'description',
                  coalesce(scene_item.scene->'description', to_jsonb(v_scene.description)),
                  'updatedAt',
                  timezone('utc'::text, now())::text
                )
                order by scene_item.ordinality
              ),
              '[]'::jsonb
            )
            from jsonb_array_elements(
              case
                when jsonb_array_length(coalesce(v_scene.tabletop_state->'scenes', '[]'::jsonb)) > 0
                  then coalesce(v_scene.tabletop_state->'scenes', '[]'::jsonb)
                else jsonb_build_array('{}'::jsonb)
              end
            ) with ordinality as scene_item(scene, ordinality)
          ),
        true
      );

      v_tabletop_state := jsonb_set(
        v_tabletop_state,
        '{tokens}',
        coalesce(v_tabletop_state->'tokens', '[]'::jsonb) ||
          (
            select coalesce(
              jsonb_agg(
                token_map.token
                || jsonb_build_object(
                  'id', gen_random_uuid()::text,
                  'roomId', p_room_id::text,
                  'sceneId', token_map.room_scene_id::text,
                  'characterId', token_map.mapped_character_id::text,
                  'updatedAt', timezone('utc'::text, now())::text
                )
                order by token_map.ordinality
              ),
              '[]'::jsonb
            )
            from (
              select
                token_item.token,
                token_item.ordinality,
                coalesce(
                  nullif(v_scene_id_map->>(token_item.token->>'sceneId'), '')::uuid,
                  v_room_scene_id
                ) as room_scene_id,
                (
                  select mapped_character.id
                  from public.module_template_characters template_character
                  join public.characters mapped_character
                    on mapped_character.room_id = p_room_id
                    and mapped_character.type = template_character.character_type
                    and mapped_character.name = coalesce(
                      nullif(template_character.payload->>'name', ''),
                      template_character.template_character_key
                    )
                  where template_character.template_id = p_template_id
                    and template_character.character_type in ('npc', 'monster')
                    and (
                      template_character.template_character_key = replace(coalesce(token_item.token->>'characterId', ''), 'module-character:', '')
                      or template_character.template_character_key like replace(coalesce(token_item.token->>'characterId', ''), 'module-character:', '') || '-%'
                    )
                  order by
                    case
                      when template_character.template_character_key = replace(coalesce(token_item.token->>'characterId', ''), 'module-character:', '')
                        then 0
                      else 1
                    end,
                    template_character.display_order asc,
                    template_character.created_at asc,
                    mapped_character.created_at asc
                  limit 1
                ) as mapped_character_id
              from jsonb_array_elements(coalesce(v_scene.tabletop_state->'tokens', '[]'::jsonb))
                with ordinality as token_item(token, ordinality)
            ) token_map
            where token_map.mapped_character_id is not null
          ),
        true
      );

      v_tabletop_state := jsonb_set(
        v_tabletop_state,
        '{shapes}',
        coalesce(v_tabletop_state->'shapes', '[]'::jsonb) ||
          (
            select coalesce(
              jsonb_agg(
                shape_item.shape
                || jsonb_build_object(
                  'sceneId',
                  coalesce(
                    nullif(v_scene_id_map->>(shape_item.shape->>'sceneId'), ''),
                    v_room_scene_id::text
                  ),
                  'updatedAt',
                  timezone('utc'::text, now())::text
                )
                order by shape_item.ordinality
              ),
              '[]'::jsonb
            )
            from jsonb_array_elements(coalesce(v_scene.tabletop_state->'shapes', '[]'::jsonb))
              with ordinality as shape_item(shape, ordinality)
          ),
        true
      );

      v_tabletop_state := jsonb_set(
        v_tabletop_state,
        '{fogRegions}',
        coalesce(v_tabletop_state->'fogRegions', '[]'::jsonb) ||
          (
            select coalesce(
              jsonb_agg(
                fog_item.region
                || jsonb_build_object(
                  'sceneId',
                  coalesce(
                    nullif(v_scene_id_map->>(fog_item.region->>'sceneId'), ''),
                    v_room_scene_id::text
                  )
                )
                order by fog_item.ordinality
              ),
              '[]'::jsonb
            )
            from jsonb_array_elements(coalesce(v_scene.tabletop_state->'fogRegions', '[]'::jsonb))
              with ordinality as fog_item(region, ordinality)
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
          v_room_scene_id,
          v_marker_character_id,
          least(100, greatest(0, coalesce((v_marker->>'x')::numeric, 50))),
          least(100, greatest(0, coalesce((v_marker->>'y')::numeric, 50))),
          coalesce((v_marker->>'is_hidden')::boolean, true),
          nullif(v_marker->>'label', '')
        )
        on conflict (scene_id, character_id) do update
        set x = excluded.x,
            y = excluded.y,
            is_hidden = excluded.is_hidden,
            label = excluded.label,
            updated_at = timezone('utc'::text, now());
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
    v_active_scene_id := nullif(v_tabletop_state->>'activeSceneId', '')::uuid;
    if v_active_scene_id is not null then
      update public.room_scenes
      set is_active = false,
          updated_at = timezone('utc'::text, now())
      where room_id = p_room_id
        and is_active
        and id <> v_active_scene_id;

      update public.room_scenes
      set is_active = true,
          updated_at = timezone('utc'::text, now())
      where id = v_active_scene_id
        and room_id = p_room_id;
    end if;

    delete from public.room_tabletop_tokens
    where room_id = p_room_id;

    insert into public.room_tabletop_tokens (
      id,
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
      updated_by_user_id,
      updated_at
    )
    select
      coalesce(nullif(token->>'id', '')::uuid, gen_random_uuid()),
      p_room_id,
      (token->>'sceneId')::uuid,
      (token->>'characterId')::uuid,
      coalesce((token->>'x')::numeric, 0),
      coalesce((token->>'y')::numeric, 0),
      least(180, greatest(12, coalesce((token->>'size')::numeric, 42))),
      coalesce((token->>'rotation')::numeric, 0),
      coalesce((token->>'zIndex')::integer, 1),
      coalesce((token->>'isHidden')::boolean, false),
      coalesce((token->>'isLocked')::boolean, false),
      nullif(token->>'label', ''),
      v_user_id,
      timezone('utc'::text, now())
    from jsonb_array_elements(coalesce(v_tabletop_state->'tokens', '[]'::jsonb)) token
    where nullif(token->>'sceneId', '') is not null
      and nullif(token->>'characterId', '') is not null
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
        updated_at = excluded.updated_at;

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

revoke all on function app_private.copy_module_template_scenes_to_room(uuid, uuid) from public;
grant execute on function app_private.copy_module_template_scenes_to_room(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
