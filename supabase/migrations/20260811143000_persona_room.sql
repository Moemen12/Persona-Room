create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  supabase_auth_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.memories (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 200),
  importance smallint not null default 1 check (importance between 1 and 3),
  created_at timestamptz not null default now()
);
create index if not exists memories_user_created_at_idx on public.memories(user_id, created_at desc);

create table if not exists public.conversations (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists conversations_user_created_at_idx on public.conversations(user_id, created_at desc);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  audience_enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_created_at_idx on public.sessions(user_id, created_at desc);

create table if not exists public.votes (
  id bigserial primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  option text not null check (option in ('sing', 'joke', 'art', 'surprise')),
  voter_fingerprint text not null check (char_length(voter_fingerprint) between 12 and 160),
  created_at timestamptz not null default now()
);
create index if not exists votes_session_created_at_idx on public.votes(session_id, created_at desc);

alter table public.users enable row level security;
alter table public.memories enable row level security;
alter table public.conversations enable row level security;
alter table public.sessions enable row level security;
alter table public.votes enable row level security;

create policy "users can read their own profile"
on public.users for select to authenticated
using (supabase_auth_id = auth.uid());

create policy "users can update their own profile"
on public.users for update to authenticated
using (supabase_auth_id = auth.uid())
with check (supabase_auth_id = auth.uid());

create policy "users can read their own memories"
on public.memories for select to authenticated
using (exists (select 1 from public.users where users.id = memories.user_id and users.supabase_auth_id = auth.uid()));

create policy "users can read their own conversations"
on public.conversations for select to authenticated
using (exists (select 1 from public.users where users.id = conversations.user_id and users.supabase_auth_id = auth.uid()));

create policy "users can read their own sessions"
on public.sessions for select to authenticated
using (exists (select 1 from public.users where users.id = sessions.user_id and users.supabase_auth_id = auth.uid()));

create policy "anonymous audience can insert votes"
on public.votes for insert to anon, authenticated
with check (true);

alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.votes;
