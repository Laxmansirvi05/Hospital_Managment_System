-- Admin audit log (D-83). One row for every change an admin makes: who, what, which record, when.
-- The log never holds health data, passwords or contact details. It is append only for the API
-- role, so a compromised admin session cannot rewrite history.

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  -- Kept as null when the admin account is deleted later (D-45); the row stays for the record.
  actor_user_id uuid references public.users (id) on delete set null,
  action text not null check (char_length(action) between 1 and 60),
  target_kind text not null check (target_kind in ('user', 'hospital', 'doctor', 'pharmacy', 'diagnostic_centre', 'review')),
  target_id text not null check (char_length(target_id) <= 80),
  summary text not null default '' check (char_length(summary) <= 300),
  created_at timestamptz not null default now()
);

create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index admin_audit_log_target_idx on public.admin_audit_log (target_kind, target_id);

alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;
revoke update, delete on public.admin_audit_log from careroute_api;
