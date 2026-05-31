-- Move room passwords out of the public rooms row.
create extension if not exists pgcrypto with schema extensions;

alter table public.rooms
  add column if not exists has_password boolean not null default false;

create table if not exists public.room_secrets (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  password_hash text not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.room_secrets enable row level security;

drop policy if exists "Room secrets are private" on public.room_secrets;
create policy "Room secrets are private"
  on public.room_secrets
  for all
  using (false)
  with check (false);

insert into public.room_secrets (room_id, password_hash)
select id, extensions.crypt(password, extensions.gen_salt('bf'))
from public.rooms
where nullif(password, '') is not null
on conflict (room_id) do update
set password_hash = excluded.password_hash,
    updated_at = timezone('utc'::text, now());

update public.rooms
set has_password = exists (
      select 1 from public.room_secrets rs where rs.room_id = rooms.id
    ),
    password = null;

create or replace function public.clear_room_password_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.password = null;
  return new;
end;
$$;

drop trigger if exists clear_room_password_column_on_rooms on public.rooms;
create trigger clear_room_password_column_on_rooms
  before insert or update of password on public.rooms
  for each row
  execute function public.clear_room_password_column();

create or replace function public.set_room_password(
  p_room_id uuid,
  p_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_kp_id uuid;
begin
  select kp_id into v_kp_id
  from public.rooms
  where id = p_room_id;

  if v_kp_id is null then
    raise exception 'Room not found';
  end if;

  if v_kp_id <> auth.uid() then
    raise exception 'Only the room keeper can update the password';
  end if;

  if nullif(p_password, '') is null then
    delete from public.room_secrets where room_id = p_room_id;
    update public.rooms
    set has_password = false,
        password = null
    where id = p_room_id;
    return true;
  end if;

  insert into public.room_secrets (room_id, password_hash)
  values (p_room_id, extensions.crypt(p_password, extensions.gen_salt('bf')))
  on conflict (room_id) do update
  set password_hash = excluded.password_hash,
      updated_at = timezone('utc'::text, now());

  update public.rooms
  set has_password = true,
      password = null
  where id = p_room_id;

  return true;
end;
$$;

create or replace function public.verify_room_password(
  p_room_id uuid,
  p_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_kp_id uuid;
  v_password_hash text;
  v_has_password boolean;
begin
  select r.kp_id, r.has_password, rs.password_hash
  into v_kp_id, v_has_password, v_password_hash
  from public.rooms r
  left join public.room_secrets rs on rs.room_id = r.id
  where r.id = p_room_id;

  if v_kp_id is null then
    return false;
  end if;

  if v_kp_id = auth.uid() then
    return true;
  end if;

  if not coalesce(v_has_password, false) then
    return true;
  end if;

  if v_password_hash is null then
    return false;
  end if;

  return v_password_hash = extensions.crypt(coalesce(p_password, ''), v_password_hash);
end;
$$;

grant execute on function public.set_room_password(uuid, text) to authenticated;
grant execute on function public.verify_room_password(uuid, text) to authenticated;

notify pgrst, 'reload schema';
