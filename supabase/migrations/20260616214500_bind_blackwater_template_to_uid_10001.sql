update public.module_templates
set created_by_user_id = (
      select id
      from public.profiles
      where user_code = 10001
      limit 1
    ),
    updated_at = timezone('utc'::text, now())
where slug = 'vanishing-at-blackwater-station'
  and exists (
    select 1
    from public.profiles
    where user_code = 10001
  );

notify pgrst, 'reload schema';
