create table if not exists clue_walls (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  content jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(room_id)
);

-- RLS policies
alter table clue_walls enable row level security;

create policy "Allow read access for room participants" on clue_walls
  for select using (
    exists (
      select 1 from characters
      where characters.room_id = clue_walls.room_id
      and characters.user_id = auth.uid()
    ) or exists (
      select 1 from rooms
      where rooms.id = clue_walls.room_id
      and rooms.kp_id = auth.uid()
    )
  );

create policy "Allow update access for room participants" on clue_walls
  for update using (
    exists (
      select 1 from characters
      where characters.room_id = clue_walls.room_id
      and characters.user_id = auth.uid()
    ) or exists (
      select 1 from rooms
      where rooms.id = clue_walls.room_id
      and rooms.kp_id = auth.uid()
    )
  );

create policy "Allow insert access for room participants" on clue_walls
  for insert with check (
    exists (
      select 1 from characters
      where characters.room_id = clue_walls.room_id
      and characters.user_id = auth.uid()
    ) or exists (
      select 1 from rooms
      where rooms.id = clue_walls.room_id
      and rooms.kp_id = auth.uid()
    )
  );
