create table if not exists public.square_post_modules (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  module_type text not null check (module_type in ('character_summary', 'room_log_excerpt')),
  payload jsonb not null default '{}'::jsonb,
  source_character_id uuid references public.characters(id) on delete set null,
  source_room_id uuid references public.rooms(id) on delete set null,
  source_message_ids uuid[] not null default '{}'::uuid[],
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.square_post_modules enable row level security;

create index if not exists idx_square_post_modules_post_id
  on public.square_post_modules(post_id, display_order, created_at);

create index if not exists idx_square_post_modules_source_character_id
  on public.square_post_modules(source_character_id);

create index if not exists idx_square_post_modules_source_room_id
  on public.square_post_modules(source_room_id);

drop policy if exists "Square post modules are viewable by everyone"
  on public.square_post_modules;
create policy "Square post modules are viewable by everyone"
on public.square_post_modules
for select
using (true);

drop policy if exists "Users can create modules for own posts"
  on public.square_post_modules;
create policy "Users can create modules for own posts"
on public.square_post_modules
for insert
to authenticated
with check (
  exists (
    select 1
    from public.posts
    where posts.id = square_post_modules.post_id
      and posts.user_id = (select auth.uid())
  )
  and (
    module_type <> 'character_summary'
    or (
      source_character_id is not null
      and exists (
        select 1
        from public.characters
        where characters.id = square_post_modules.source_character_id
          and characters.user_id = (select auth.uid())
      )
    )
  )
  and (
    module_type <> 'room_log_excerpt'
    or (
      source_room_id is not null
      and cardinality(source_message_ids) > 0
      and (
        exists (
          select 1
          from public.rooms
          where rooms.id = square_post_modules.source_room_id
            and rooms.kp_id = (select auth.uid())
        )
        or exists (
          select 1
          from public.room_members
          where room_members.room_id = square_post_modules.source_room_id
            and room_members.user_id = (select auth.uid())
            and room_members.status = 'active'
        )
        or exists (
          select 1
          from public.characters
          where characters.room_id = square_post_modules.source_room_id
            and characters.user_id = (select auth.uid())
        )
      )
      and not exists (
        select 1
        from unnest(source_message_ids) as source_message_id
        where not exists (
          select 1
          from public.messages
          where messages.id = source_message_id
            and messages.room_id = square_post_modules.source_room_id
            and messages.recipient_id is null
            and messages.type <> 'dice_secret'
        )
      )
    )
  )
);

drop policy if exists "Users can delete modules for own posts"
  on public.square_post_modules;
create policy "Users can delete modules for own posts"
on public.square_post_modules
for delete
to authenticated
using (
  exists (
    select 1
    from public.posts
    where posts.id = square_post_modules.post_id
      and posts.user_id = (select auth.uid())
  )
);

grant select on public.square_post_modules to anon, authenticated;
grant insert, delete on public.square_post_modules to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  )
  and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'square_post_modules'
  ) then
    alter publication supabase_realtime add table public.square_post_modules;
  end if;
end $$;

notify pgrst, 'reload schema';
