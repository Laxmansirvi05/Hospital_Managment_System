-- The AI assistant (D-65 to D-68): the patient's agreement to send health facts to a model, and
-- saved conversations. Only the server reads these tables: RLS on, no policy for anon or authenticated.

-- When the patient agreed that their message, health facts and documents may be sent to the
-- assistant's model providers (D-67). Empty means not agreed; nothing is sent to a model then.
alter table public.users add column assistant_consent_at timestamptz;

create table public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assistant_conversations_user_idx on public.assistant_conversations (user_id, updated_at desc);
alter table public.assistant_conversations enable row level security;

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 4000),
  -- Structured parts of an answer: urgency, suggested speciality, listing ids shown, documents used.
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index assistant_messages_conversation_idx on public.assistant_messages (conversation_id, created_at);
alter table public.assistant_messages enable row level security;
