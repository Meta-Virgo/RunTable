-- Prevent template_character_key from accumulating "-1-1-1" suffixes on repeated saves,
-- which previously broke tabletop_state.tokens[].characterId linkage on edit & save.

create or replace function public.replace_user_module_template_characters(
  p_template_id uuid,
  p_characters jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_character jsonb;
  v_index integer := 0;
  v_character_type text;
  v_name text;
  v_key text;
  v_final_key text;
  v_used_keys text[] := '{}'::text[];
begin
  if p_characters is not null and jsonb_typeof(p_characters) <> 'array' then
    raise exception 'Invalid module characters';
  end if;

  delete from public.module_template_characters
  where template_id = p_template_id;

  for v_character in
    select value
    from jsonb_array_elements(coalesce(p_characters, '[]'::jsonb))
  loop
    v_index := v_index + 1;
    v_character_type := coalesce(v_character->>'character_type', v_character->>'characterType');

    if v_character_type not in ('npc', 'monster') then
      raise exception 'Invalid module character type';
    end if;

    if jsonb_typeof(coalesce(v_character->'payload', '{}'::jsonb)) <> 'object' then
      raise exception 'Invalid module character payload';
    end if;

    v_name := trim(coalesce(v_character->'payload'->>'name', ''));
    v_key := lower(regexp_replace(
      coalesce(nullif(trim(v_character->>'key'), ''), nullif(v_name, ''), 'character-' || v_index::text),
      '[^[:alnum:]]+',
      '-',
      'g'
    ));
    v_key := trim(both '-' from v_key);
    if v_key = '' then
      v_key := 'character-' || v_index::text;
    end if;

    v_final_key := v_key;
    if v_final_key = any(v_used_keys) then
      v_final_key := v_key || '-' || v_index::text;
    end if;
    v_used_keys := array_append(v_used_keys, v_final_key);

    insert into public.module_template_characters (
      template_id,
      template_character_key,
      character_type,
      payload,
      display_order
    )
    values (
      p_template_id,
      v_final_key,
      v_character_type,
      coalesce(v_character->'payload', '{}'::jsonb),
      coalesce((v_character->>'display_order')::integer, v_index)
    );
  end loop;
end;
$$;

notify pgrst, 'reload schema';
