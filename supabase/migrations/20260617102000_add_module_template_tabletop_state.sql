alter table public.module_template_scenes
  add column if not exists tabletop_state jsonb;

create or replace function public.create_user_module_template(
  p_title text,
  p_summary text,
  p_system text default 'coc',
  p_cover_image_url text default null,
  p_tags text[] default '{}'::text[],
  p_recommended_players_min integer default 2,
  p_recommended_players_max integer default 4,
  p_estimated_minutes_min integer default 120,
  p_estimated_minutes_max integer default 240,
  p_complexity text default 'standard',
  p_tone text default null,
  p_content_warnings text[] default '{}'::text[],
  p_player_facing_premise text default '',
  p_keeper_notes text default null,
  p_default_room_type text default 'text',
  p_bg_music_url text default null,
  p_scene jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_template_id uuid;
  v_slug text;
  v_title text := trim(coalesce(p_title, ''));
  v_summary text := trim(coalesce(p_summary, ''));
  v_system text := lower(trim(coalesce(nullif(p_system, ''), 'coc')));
  v_player_facing_premise text := trim(coalesce(p_player_facing_premise, ''));
  v_recommended_players_min integer := least(12, greatest(1, coalesce(p_recommended_players_min, 2)));
  v_recommended_players_max integer := least(12, greatest(1, coalesce(p_recommended_players_max, 4)));
  v_estimated_minutes_min integer := greatest(1, coalesce(p_estimated_minutes_min, 120));
  v_estimated_minutes_max integer := greatest(1, coalesce(p_estimated_minutes_max, 240));
  v_scene_title text := trim(coalesce(p_scene->>'title', ''));
  v_scene_background_color text := coalesce(nullif(trim(p_scene->>'background_color'), ''), '#182033');
  v_scene_background_pattern text := coalesce(nullif(trim(p_scene->>'background_pattern'), ''), 'grid');
  v_tabletop_state jsonb := p_scene->'tabletop_state';
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if v_title = '' then
    raise exception 'Module title is required';
  end if;

  if v_summary = '' then
    raise exception 'Module summary is required';
  end if;

  if v_player_facing_premise = '' then
    raise exception 'Player-facing premise is required';
  end if;

  if v_recommended_players_min > v_recommended_players_max then
    raise exception 'Recommended player range is invalid';
  end if;

  if v_estimated_minutes_min > v_estimated_minutes_max then
    raise exception 'Estimated duration range is invalid';
  end if;

  if coalesce(p_complexity, 'standard') not in ('intro', 'standard', 'advanced') then
    raise exception 'Invalid module complexity';
  end if;

  if coalesce(p_default_room_type, 'text') not in ('text', 'voice') then
    raise exception 'Invalid default room type';
  end if;

  if v_scene_title <> '' then
    if v_scene_background_pattern not in ('plain', 'grid', 'dots', 'mist') then
      raise exception 'Invalid scene background pattern';
    end if;

    if v_scene_background_color !~ '^#[0-9A-Fa-f]{6}$' then
      raise exception 'Invalid scene background color';
    end if;

    if v_tabletop_state is not null and jsonb_typeof(v_tabletop_state) <> 'object' then
      raise exception 'Invalid scene tabletop state';
    end if;
  end if;

  v_slug := lower(regexp_replace(v_title, '[^[:alnum:]]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    v_slug := 'module';
  end if;
  v_slug := v_slug || '-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.module_templates (
    slug,
    title,
    summary,
    system,
    cover_image_url,
    tags,
    recommended_players_min,
    recommended_players_max,
    estimated_minutes_min,
    estimated_minutes_max,
    complexity,
    tone,
    content_warnings,
    player_facing_premise,
    keeper_notes,
    default_room_type,
    bg_music_url,
    status,
    created_by_user_id,
    published_at
  )
  values (
    v_slug,
    v_title,
    v_summary,
    v_system,
    nullif(trim(coalesce(p_cover_image_url, '')), ''),
    coalesce(p_tags, '{}'::text[]),
    v_recommended_players_min,
    v_recommended_players_max,
    v_estimated_minutes_min,
    v_estimated_minutes_max,
    coalesce(nullif(p_complexity, ''), 'standard'),
    nullif(trim(coalesce(p_tone, '')), ''),
    coalesce(p_content_warnings, '{}'::text[]),
    v_player_facing_premise,
    nullif(trim(coalesce(p_keeper_notes, '')), ''),
    coalesce(nullif(p_default_room_type, ''), 'text'),
    nullif(trim(coalesce(p_bg_music_url, '')), ''),
    'published',
    v_user_id,
    timezone('utc'::text, now())
  )
  returning id into v_template_id;

  if v_scene_title <> '' then
    insert into public.module_template_scenes (
      template_id,
      template_scene_key,
      title,
      description,
      background_color,
      background_pattern,
      tabletop_state,
      is_default,
      marker_payload,
      display_order
    )
    values (
      v_template_id,
      'starter-scene',
      v_scene_title,
      nullif(trim(coalesce(p_scene->>'description', '')), ''),
      v_scene_background_color,
      v_scene_background_pattern,
      v_tabletop_state,
      true,
      '[]'::jsonb,
      1
    );
  end if;

  return v_template_id;
end;
$$;

create or replace function public.update_user_module_template(
  p_template_id uuid,
  p_title text,
  p_summary text,
  p_system text default 'coc',
  p_cover_image_url text default null,
  p_tags text[] default '{}'::text[],
  p_recommended_players_min integer default 2,
  p_recommended_players_max integer default 4,
  p_estimated_minutes_min integer default 120,
  p_estimated_minutes_max integer default 240,
  p_complexity text default 'standard',
  p_tone text default null,
  p_content_warnings text[] default '{}'::text[],
  p_player_facing_premise text default '',
  p_keeper_notes text default null,
  p_default_room_type text default 'text',
  p_bg_music_url text default null,
  p_scene jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text := trim(coalesce(p_title, ''));
  v_summary text := trim(coalesce(p_summary, ''));
  v_system text := lower(trim(coalesce(nullif(p_system, ''), 'coc')));
  v_player_facing_premise text := trim(coalesce(p_player_facing_premise, ''));
  v_recommended_players_min integer := least(12, greatest(1, coalesce(p_recommended_players_min, 2)));
  v_recommended_players_max integer := least(12, greatest(1, coalesce(p_recommended_players_max, 4)));
  v_estimated_minutes_min integer := greatest(1, coalesce(p_estimated_minutes_min, 120));
  v_estimated_minutes_max integer := greatest(1, coalesce(p_estimated_minutes_max, 240));
  v_scene_title text := trim(coalesce(p_scene->>'title', ''));
  v_scene_background_color text := coalesce(nullif(trim(p_scene->>'background_color'), ''), '#182033');
  v_scene_background_pattern text := coalesce(nullif(trim(p_scene->>'background_pattern'), ''), 'grid');
  v_tabletop_state jsonb := p_scene->'tabletop_state';
  v_scene_id uuid;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if not exists (
    select 1
    from public.module_templates template
    where template.id = p_template_id
      and template.created_by_user_id = v_user_id
  ) then
    raise exception 'Only the module owner can edit this module';
  end if;

  if v_title = '' then
    raise exception 'Module title is required';
  end if;

  if v_summary = '' then
    raise exception 'Module summary is required';
  end if;

  if v_player_facing_premise = '' then
    raise exception 'Player-facing premise is required';
  end if;

  if v_recommended_players_min > v_recommended_players_max then
    raise exception 'Recommended player range is invalid';
  end if;

  if v_estimated_minutes_min > v_estimated_minutes_max then
    raise exception 'Estimated duration range is invalid';
  end if;

  if coalesce(p_complexity, 'standard') not in ('intro', 'standard', 'advanced') then
    raise exception 'Invalid module complexity';
  end if;

  if coalesce(p_default_room_type, 'text') not in ('text', 'voice') then
    raise exception 'Invalid default room type';
  end if;

  if v_scene_title <> '' then
    if v_scene_background_pattern not in ('plain', 'grid', 'dots', 'mist') then
      raise exception 'Invalid scene background pattern';
    end if;

    if v_scene_background_color !~ '^#[0-9A-Fa-f]{6}$' then
      raise exception 'Invalid scene background color';
    end if;

    if v_tabletop_state is not null and jsonb_typeof(v_tabletop_state) <> 'object' then
      raise exception 'Invalid scene tabletop state';
    end if;
  end if;

  update public.module_templates
  set title = v_title,
      summary = v_summary,
      system = v_system,
      cover_image_url = nullif(trim(coalesce(p_cover_image_url, '')), ''),
      tags = coalesce(p_tags, '{}'::text[]),
      recommended_players_min = v_recommended_players_min,
      recommended_players_max = v_recommended_players_max,
      estimated_minutes_min = v_estimated_minutes_min,
      estimated_minutes_max = v_estimated_minutes_max,
      complexity = coalesce(nullif(p_complexity, ''), 'standard'),
      tone = nullif(trim(coalesce(p_tone, '')), ''),
      content_warnings = coalesce(p_content_warnings, '{}'::text[]),
      player_facing_premise = v_player_facing_premise,
      keeper_notes = nullif(trim(coalesce(p_keeper_notes, '')), ''),
      default_room_type = coalesce(nullif(p_default_room_type, ''), 'text'),
      bg_music_url = nullif(trim(coalesce(p_bg_music_url, '')), ''),
      updated_at = timezone('utc'::text, now())
  where id = p_template_id
    and created_by_user_id = v_user_id;

  if v_scene_title <> '' then
    select id
    into v_scene_id
    from public.module_template_scenes
    where template_id = p_template_id
    order by is_default desc, display_order asc, created_at asc
    limit 1;

    update public.module_template_scenes
    set is_default = false,
        updated_at = timezone('utc'::text, now())
    where template_id = p_template_id;

    if v_scene_id is not null then
      update public.module_template_scenes
      set title = v_scene_title,
          description = nullif(trim(coalesce(p_scene->>'description', '')), ''),
          background_color = v_scene_background_color,
          background_pattern = v_scene_background_pattern,
          tabletop_state = v_tabletop_state,
          is_default = true,
          updated_at = timezone('utc'::text, now())
      where id = v_scene_id;
    else
      insert into public.module_template_scenes (
        template_id,
        template_scene_key,
        title,
        description,
        background_color,
        background_pattern,
        tabletop_state,
        is_default,
        marker_payload,
        display_order
      )
      values (
        p_template_id,
        'starter-scene',
        v_scene_title,
        nullif(trim(coalesce(p_scene->>'description', '')), ''),
        v_scene_background_color,
        v_scene_background_pattern,
        v_tabletop_state,
        true,
        '[]'::jsonb,
        1
      );
    end if;
  else
    update public.module_template_scenes
    set is_default = false,
        tabletop_state = null,
        updated_at = timezone('utc'::text, now())
    where template_id = p_template_id;
  end if;

  return p_template_id;
end;
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
  end if;
end;
$$;

revoke all on function public.create_user_module_template(
  text,
  text,
  text,
  text,
  text[],
  integer,
  integer,
  integer,
  integer,
  text,
  text,
  text[],
  text,
  text,
  text,
  text,
  jsonb
) from public;
grant execute on function public.create_user_module_template(
  text,
  text,
  text,
  text,
  text[],
  integer,
  integer,
  integer,
  integer,
  text,
  text,
  text[],
  text,
  text,
  text,
  text,
  jsonb
) to authenticated;

revoke all on function public.update_user_module_template(
  uuid,
  text,
  text,
  text,
  text,
  text[],
  integer,
  integer,
  integer,
  integer,
  text,
  text,
  text[],
  text,
  text,
  text,
  text,
  jsonb
) from public;
grant execute on function public.update_user_module_template(
  uuid,
  text,
  text,
  text,
  text,
  text[],
  integer,
  integer,
  integer,
  integer,
  text,
  text,
  text[],
  text,
  text,
  text,
  text,
  jsonb
) to authenticated;

revoke all on function app_private.copy_module_template_scenes_to_room(uuid, uuid) from public;
grant execute on function app_private.copy_module_template_scenes_to_room(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
