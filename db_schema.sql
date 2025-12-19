-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table
-- Maps to Supabase Auth user
create table profiles (
  id uuid references auth.users not null primary key,
  nickname text,
  bio text,
  user_code serial,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Rooms table
create table rooms (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  kp_id uuid references profiles(id) not null,
  title text not null,
  description text,
  status text check (status in ('open', 'closed', 'archived')) default 'open'
);

-- Characters table
create table characters (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references profiles(id),
  room_id uuid references rooms(id),
  name text not null,
  role text default '调查员',
  type text check (type in ('investigator', 'npc', 'monster')) default 'investigator',
  theme_color text,
  inventory text,
  info jsonb default '{}'::jsonb,
  stats jsonb default '{}'::jsonb
);

-- Messages table
create table messages (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  room_id uuid references rooms(id) not null,
  user_id uuid references profiles(id) not null,
  character_id uuid references characters(id),
  recipient_id uuid references profiles(id),
  type text check (type in ('text', 'dice', 'system')) default 'text',
  content text,
  meta jsonb default '{}'::jsonb
);

-- Enable Row Level Security (RLS)
alter table profiles enable row level security;
alter table rooms enable row level security;
alter table characters enable row level security;
alter table messages enable row level security;

-- Basic Policies (Open for all authenticated users for simplicity in this template)
-- You should refine these for production use

-- Profiles: Publicly readable, editable by owner
create policy "Public profiles are viewable by everyone." on profiles for select using ( true );
create policy "Users can insert their own profile." on profiles for insert with check ( auth.uid() = id );
create policy "Users can update own profile." on profiles for update using ( auth.uid() = id );

-- Rooms: Readable by everyone, create/update by authenticated users
create policy "Rooms are viewable by everyone." on rooms for select using ( true );
create policy "Authenticated users can create rooms." on rooms for insert with check ( auth.role() = 'authenticated' );
create policy "KP can update their rooms." on rooms for update using ( auth.uid() = kp_id );

-- Characters: Readable by everyone (or refine to room members), create/update by owner or KP
create policy "Characters are viewable by everyone." on characters for select using ( true );
create policy "Authenticated users can create characters." on characters for insert with check ( auth.role() = 'authenticated' );
create policy "Users can update own characters." on characters for update using ( auth.uid() = user_id );

-- Messages: Readable by room members (simplified to everyone here), insert by authenticated
create policy "Messages are viewable by everyone." on messages for select using ( true );
create policy "Authenticated users can insert messages." on messages for insert with check ( auth.role() = 'authenticated' );
