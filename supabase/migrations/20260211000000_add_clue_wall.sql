create table if not exists public.clue_walls (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  content jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (room_id)
);

alter table public.clue_walls enable row level security;

drop policy if exists "Allow read access for room participants" on public.clue_walls;
create policy "Allow read access for room participants"
on public.clue_walls
for select
using (
  exists (
    select 1
    from public.characters
    where characters.room_id = clue_walls.room_id
      and characters.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.rooms
    where rooms.id = clue_walls.room_id
      and rooms.kp_id = auth.uid()
  )
);

drop policy if exists "Allow insert access for room participants" on public.clue_walls;
create policy "Allow insert access for room participants"
on public.clue_walls
for insert
with check (
  exists (
    select 1
    from public.characters
    where characters.room_id = clue_walls.room_id
      and characters.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.rooms
    where rooms.id = clue_walls.room_id
      and rooms.kp_id = auth.uid()
  )
);

drop policy if exists "Allow update access for room participants" on public.clue_walls;
create policy "Allow update access for room participants"
on public.clue_walls
for update
using (
  exists (
    select 1
    from public.characters
    where characters.room_id = clue_walls.room_id
      and characters.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.rooms
    where rooms.id = clue_walls.room_id
      and rooms.kp_id = auth.uid()
  )
);
