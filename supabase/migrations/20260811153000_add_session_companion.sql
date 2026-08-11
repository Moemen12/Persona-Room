-- Persist the selected companion on each room session and scope stored history by companion.
alter table public.sessions
  add column if not exists companion_id text not null default 'rina'
  check (companion_id in ('rina', 'joon'));

alter table public.conversations
  add column if not exists companion_id text not null default 'rina'
  check (companion_id in ('rina', 'joon'));

create index if not exists conversations_user_companion_created_at_idx
  on public.conversations (user_id, companion_id, created_at desc);
