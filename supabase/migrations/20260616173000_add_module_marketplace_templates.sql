create table if not exists public.module_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null,
  system text not null default 'coc',
  cover_image_url text,
  tags text[] not null default '{}'::text[],
  recommended_players_min integer not null default 2
    check (recommended_players_min >= 1 and recommended_players_min <= 12),
  recommended_players_max integer not null default 4
    check (recommended_players_max >= 1 and recommended_players_max <= 12),
  estimated_minutes_min integer not null default 120
    check (estimated_minutes_min > 0),
  estimated_minutes_max integer not null default 240
    check (estimated_minutes_max > 0),
  complexity text not null default 'standard'
    check (complexity in ('intro', 'standard', 'advanced')),
  tone text,
  content_warnings text[] not null default '{}'::text[],
  player_facing_premise text not null,
  keeper_notes text,
  default_room_type text not null default 'text'
    check (default_room_type in ('text', 'voice')),
  bg_music_url text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_by_user_id uuid references public.profiles(id) on delete set null,
  published_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  check (char_length(trim(slug)) > 0),
  check (char_length(trim(title)) > 0),
  check (recommended_players_min <= recommended_players_max),
  check (estimated_minutes_min <= estimated_minutes_max)
);

create table if not exists public.module_template_characters (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.module_templates(id) on delete cascade,
  template_character_key text not null,
  character_type text not null check (character_type in ('investigator', 'npc', 'monster')),
  payload jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (template_id, template_character_key),
  check (char_length(trim(template_character_key)) > 0)
);

create table if not exists public.module_template_scenes (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.module_templates(id) on delete cascade,
  template_scene_key text not null,
  title text not null,
  description text,
  background_color text not null default '#182033',
  background_pattern text not null default 'plain'
    check (background_pattern in ('plain', 'grid', 'dots', 'mist')),
  is_default boolean not null default false,
  marker_payload jsonb not null default '[]'::jsonb,
  display_order integer not null default 0,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (template_id, template_scene_key),
  check (char_length(trim(template_scene_key)) > 0),
  check (char_length(trim(title)) > 0),
  check (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  check (jsonb_typeof(marker_payload) = 'array')
);

create unique index if not exists idx_module_template_scenes_one_default
  on public.module_template_scenes(template_id)
  where is_default;

create index if not exists idx_module_templates_status_updated
  on public.module_templates(status, updated_at desc);

create index if not exists idx_module_templates_tags
  on public.module_templates using gin(tags);

create index if not exists idx_module_template_characters_template_order
  on public.module_template_characters(template_id, display_order, created_at);

create index if not exists idx_module_template_scenes_template_order
  on public.module_template_scenes(template_id, display_order, created_at);

alter table public.module_templates enable row level security;
alter table public.module_template_characters enable row level security;
alter table public.module_template_scenes enable row level security;

grant select on public.module_templates to anon, authenticated;
grant select on public.module_template_characters to anon, authenticated;
grant select on public.module_template_scenes to anon, authenticated;

drop policy if exists "Published module templates are viewable" on public.module_templates;
create policy "Published module templates are viewable"
on public.module_templates
for select
using (status = 'published');

drop policy if exists "Published module template characters are viewable" on public.module_template_characters;
create policy "Published module template characters are viewable"
on public.module_template_characters
for select
using (
  exists (
    select 1
    from public.module_templates template
    where template.id = module_template_characters.template_id
      and template.status = 'published'
  )
);

drop policy if exists "Published module template scenes are viewable" on public.module_template_scenes;
create policy "Published module template scenes are viewable"
on public.module_template_scenes
for select
using (
  exists (
    select 1
    from public.module_templates template
    where template.id = module_template_scenes.template_id
      and template.status = 'published'
  )
);

create or replace function app_private.create_room_from_module_template(
  p_template_id uuid,
  p_title text default null,
  p_room_type text default 'text',
  p_password text default null,
  p_cover_image_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_template public.module_templates;
  v_room public.rooms;
  v_character record;
  v_scene record;
  v_marker jsonb;
  v_new_character_id uuid;
  v_new_scene_id uuid;
  v_character_map jsonb := '{}'::jsonb;
  v_marker_character_id uuid;
  v_room_type text := coalesce(nullif(p_room_type, ''), 'text');
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if v_room_type not in ('text', 'voice') then
    raise exception 'Invalid room type';
  end if;

  select *
  into v_template
  from public.module_templates
  where id = p_template_id
    and status = 'published';

  if v_template.id is null then
    raise exception 'Module template not found';
  end if;

  insert into public.rooms (
    title,
    description,
    cover_image_url,
    kp_id,
    status,
    has_password,
    type,
    bg_music_url
  )
  values (
    coalesce(nullif(trim(p_title), ''), v_template.title),
    v_template.player_facing_premise,
    coalesce(nullif(trim(coalesce(p_cover_image_url, '')), ''), v_template.cover_image_url),
    v_user_id,
    'open',
    nullif(p_password, '') is not null,
    v_room_type,
    v_template.bg_music_url
  )
  returning * into v_room;

  insert into public.room_members (
    room_id,
    user_id,
    character_id,
    role,
    status,
    password_verified_at,
    last_seen_at,
    left_at,
    updated_at
  )
  values (
    v_room.id,
    v_user_id,
    null,
    'keeper',
    'active',
    timezone('utc'::text, now()),
    timezone('utc'::text, now()),
    null,
    timezone('utc'::text, now())
  )
  on conflict (room_id, user_id) do update
  set character_id = null,
      role = 'keeper',
      status = 'active',
      password_verified_at = timezone('utc'::text, now()),
      last_seen_at = timezone('utc'::text, now()),
      left_at = null,
      updated_at = timezone('utc'::text, now());

  if nullif(p_password, '') is not null then
    insert into public.room_secrets (room_id, password_hash)
    values (v_room.id, extensions.crypt(p_password, extensions.gen_salt('bf')))
    on conflict (room_id) do update
    set password_hash = excluded.password_hash,
        updated_at = timezone('utc'::text, now());
  end if;

  insert into public.messages (room_id, user_id, character_id, type, content, meta)
  values (
    v_room.id,
    v_user_id,
    null,
    'system',
    'Room created from module template: ' || v_template.title,
    jsonb_build_object(
      'type', 'module_template_created',
      'templateId', v_template.id,
      'templateTitle', v_template.title,
      'keeperNotes', coalesce(v_template.keeper_notes, '')
    )
  );

  for v_character in
    select *
    from public.module_template_characters
    where template_id = v_template.id
      and character_type in ('npc', 'monster')
    order by display_order, created_at
  loop
    insert into public.characters (
      user_id,
      room_id,
      name,
      role,
      type,
      theme_color,
      avatar_url,
      inventory,
      info,
      stats
    )
    values (
      v_user_id,
      v_room.id,
      coalesce(nullif(v_character.payload->>'name', ''), v_character.template_character_key),
      coalesce(
        nullif(v_character.payload->>'role', ''),
        case when v_character.character_type = 'monster' then '怪物' else 'NPC' end
      ),
      v_character.character_type,
      coalesce(nullif(v_character.payload->>'theme_color', ''), '#6366f1'),
      nullif(v_character.payload->>'avatar_url', ''),
      nullif(v_character.payload->>'inventory', ''),
      coalesce(v_character.payload->'info', '{}'::jsonb),
      coalesce(v_character.payload->'stats', '{}'::jsonb)
    )
    returning id into v_new_character_id;

    v_character_map := v_character_map || jsonb_build_object(
      v_character.template_character_key,
      v_new_character_id
    );
  end loop;

  for v_scene in
    select *
    from public.module_template_scenes
    where template_id = v_template.id
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
      v_room.id,
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
          v_room.id,
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
    select 1 from public.room_scenes where room_id = v_room.id and is_active
  ) then
    update public.room_scenes
    set is_active = true,
        updated_at = timezone('utc'::text, now())
    where id = (
      select id
      from public.room_scenes
      where room_id = v_room.id
      order by created_at asc
      limit 1
    );
  end if;

  return v_room.id;
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
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.create_room_from_module_template(
    p_template_id,
    p_title,
    p_room_type,
    p_password,
    p_cover_image_url
  );
$$;

revoke all on function app_private.create_room_from_module_template(uuid, text, text, text, text) from public;
revoke all on function public.create_room_from_module_template(uuid, text, text, text, text) from public;
grant execute on function app_private.create_room_from_module_template(uuid, text, text, text, text) to authenticated;
grant execute on function public.create_room_from_module_template(uuid, text, text, text, text) to authenticated;

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
  published_at
)
values (
  'vanishing-at-blackwater-station',
  '黑水车站失踪案',
  '一座暴雨夜里的旧火车站，一个没有抵达终点的包裹，以及三名在候车厅消失的旅客。',
  'coc',
  'https://images.unsplash.com/photo-1519822472072-ec86d5ab6f3c?auto=format&fit=crop&w=1200&q=80',
  array['CoC', '一夜短团', '调查', '车站', '悬疑'],
  2,
  4,
  120,
  180,
  'intro',
  '雨夜、失踪、轻度惊悚',
  array['失踪', '密闭空间', '轻度惊吓'],
  '暴雨封锁了黑水镇的旧车站。调查员受托寻找一只未能送达的皮箱，却发现候车厅里的旅客名单正在被人一点点抹去。',
  '核心秘密：站长在十年前的事故中幸存，但他把失踪者献给站台下的无名存在以延长自己的生命。第一幕保持写实，第二幕开始让广播和时刻表出现异常。',
  'text',
  null,
  'published',
  timezone('utc'::text, now())
)
on conflict (slug) do update
set title = excluded.title,
    summary = excluded.summary,
    cover_image_url = excluded.cover_image_url,
    tags = excluded.tags,
    player_facing_premise = excluded.player_facing_premise,
    keeper_notes = excluded.keeper_notes,
    status = excluded.status,
    published_at = excluded.published_at,
    updated_at = timezone('utc'::text, now());

with template as (
  select id from public.module_templates where slug = 'vanishing-at-blackwater-station'
)
insert into public.module_template_characters (
  template_id,
  template_character_key,
  character_type,
  payload,
  display_order
)
select
  template.id,
  character_key,
  character_type,
  payload,
  display_order
from template
cross join (
  values
    (
      'station-master-liang',
      'npc',
      jsonb_build_object(
        'name', '梁站长',
        'role', 'NPC',
        'theme_color', '#f59e0b',
        'info', jsonb_build_object(
          'job', '旧车站站长',
          'age', '58',
          'sex', '男',
          'notes', '表面热情，极度回避十年前的事故。',
          'backstory', '他知道站台下方的存在需要新的名字和影子。'
        ),
        'stats', jsonb_build_object(
          'str', 45, 'con', 55, 'siz', 50, 'dex', 40, 'app', 35,
          'int', 70, 'pow', 65, 'edu', 60, 'luck', 35, 'hp', 11,
          'san', 0, 'mp', 13,
          'skills', jsonb_build_object('话术', 60, '聆听', 55, '心理学', 45)
        )
      ),
      1
    ),
    (
      'platform-shadow',
      'monster',
      jsonb_build_object(
        'name', '站台下的影子',
        'role', '怪物',
        'theme_color', '#7c3aed',
        'info', jsonb_build_object(
          'job', '无名存在',
          'age', '未知',
          'sex', '无',
          'notes', '只在广播噪音、积水倒影和废弃月台边缘显形。',
          'backstory', '吞食名字与去向的存在。'
        ),
        'stats', jsonb_build_object(
          'str', 80, 'con', 70, 'siz', 65, 'dex', 75, 'app', 5,
          'int', 60, 'pow', 85, 'edu', 0, 'luck', 30, 'hp', 16,
          'san', 0, 'mp', 17,
          'skills', jsonb_build_object('潜行', 80, '恐吓', 75, '聆听', 65)
        )
      ),
      2
    )
) as seed(character_key, character_type, payload, display_order)
on conflict (template_id, template_character_key) do update
set character_type = excluded.character_type,
    payload = excluded.payload,
    display_order = excluded.display_order;

with template as (
  select id from public.module_templates where slug = 'vanishing-at-blackwater-station'
)
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
select
  template.id,
  scene_key,
  title,
  description,
  background_color,
  background_pattern,
  is_default,
  marker_payload,
  display_order
from template
cross join (
  values
    (
      'waiting-hall',
      '候车大厅',
      '木椅、售票窗口和一台不断闪烁的旧时刻表。这里适合开场询问目击者。',
      '#182033',
      'grid',
      true,
      jsonb_build_array(
        jsonb_build_object('character_key', 'station-master-liang', 'x', 58, 'y', 42, 'is_hidden', false, 'label', '梁站长')
      ),
      1
    ),
    (
      'abandoned-platform',
      '废弃月台',
      '铁轨尽头积着黑水，广播声从没有通电的喇叭里传出。',
      '#30263a',
      'mist',
      false,
      jsonb_build_array(
        jsonb_build_object('character_key', 'platform-shadow', 'x', 72, 'y', 68, 'is_hidden', true, 'label', '阴影')
      ),
      2
    )
) as seed(scene_key, title, description, background_color, background_pattern, is_default, marker_payload, display_order)
on conflict (template_id, template_scene_key) do update
set title = excluded.title,
    description = excluded.description,
    background_color = excluded.background_color,
    background_pattern = excluded.background_pattern,
    is_default = excluded.is_default,
    marker_payload = excluded.marker_payload,
    display_order = excluded.display_order,
    updated_at = timezone('utc'::text, now());

notify pgrst, 'reload schema';
