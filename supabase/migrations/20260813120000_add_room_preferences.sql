-- Persist the room language and personality selection.
alter table public.sessions
  add column if not exists language text not null default 'en'
    check (language in ('en', 'ko', 'ar')),
  add column if not exists personality_id text not null default 'playful'
    check (personality_id in ('playful', 'melancholic', 'magnetic', 'mischievous', 'roaster', 'dramatic'));

-- Scope transcript history to the exact room configuration/session.
alter table public.conversations
  add column if not exists session_id uuid references public.sessions(id) on delete cascade;

-- Existing rows are associated with the newest matching room where possible.
update public.conversations as conversation
set session_id = latest_session.id
from lateral (
  select session.id
  from public.sessions as session
  where session.user_id = conversation.user_id
    and session.companion_id = conversation.companion_id
  order by session.created_at desc
  limit 1
) as latest_session
where conversation.session_id is null;

create index if not exists conversations_session_created_at_idx
  on public.conversations (session_id, created_at desc, id desc);
