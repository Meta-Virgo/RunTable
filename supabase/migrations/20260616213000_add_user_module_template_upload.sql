revoke insert on public.module_templates from authenticated;
revoke insert on public.module_template_scenes from authenticated;

drop policy if exists "Users can create own published module templates"
  on public.module_templates;
create policy "Users can create own published module templates"
on public.module_templates
for insert
to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and status = 'published'
  and published_at is not null
);

drop policy if exists "Users can create scenes for own module templates"
  on public.module_template_scenes;
create policy "Users can create scenes for own module templates"
on public.module_template_scenes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.module_templates template
    where template.id = module_template_scenes.template_id
      and template.created_by_user_id = (select auth.uid())
  )
);

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
      true,
      '[]'::jsonb,
      1
    );
  end if;

  return v_template_id;
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
        true,
        '[]'::jsonb,
        1
      );
    end if;
  end if;

  return p_template_id;
end;
$$;

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

notify pgrst, 'reload schema';
