-- Expand the locked personality set without rewriting the earlier migration.
alter table public.sessions
drop constraint if exists sessions_personality_id_check;

alter table public.sessions
add constraint sessions_personality_id_check
check (
  personality_id in (
    'playful',
    'mischievous',
    'roaster',
    'melancholic',
    'dramatic',
    'magnetic',
    'fiery',
    'sultry'
  )
);
