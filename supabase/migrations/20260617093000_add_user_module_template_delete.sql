create or replace function public.delete_user_module_template(
  p_template_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
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
    raise exception 'Only the module owner can delete this module';
  end if;

  delete from public.module_templates
  where id = p_template_id
    and created_by_user_id = v_user_id;
end;
$$;

revoke all on function public.delete_user_module_template(uuid) from public;
grant execute on function public.delete_user_module_template(uuid) to authenticated;

notify pgrst, 'reload schema';
