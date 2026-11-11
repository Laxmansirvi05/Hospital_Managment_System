-- Driver approval and password reset requests (owner, 2026-11-12, D-87 and D-88).
--
-- A driver who signs up is `pending` until an admin checks the person and the vehicle and approves
-- them; only an approved driver can go online or receive requests. Patients and admins have no
-- approval status. Drivers that already exist are approved, so nobody is locked out by this change.
--
-- A password reset starts as a request from the person (no email is sent), an admin then issues a
-- one-time link and gives it to them. Only the hash of the link is stored.

alter table public.users
  add column driver_approval text check (driver_approval in ('pending', 'approved', 'rejected')),
  add column driver_reviewed_at timestamptz,
  add column driver_reviewed_by uuid references public.users (id) on delete set null,
  add column driver_review_note text check (char_length(driver_review_note) <= 300),
  -- Set for an account that starts with a password someone else chose, so the portal asks for a new one.
  add column password_change_required boolean not null default false,
  add constraint users_driver_approval_only_for_drivers check (driver_approval is null or role = 'driver');

update public.users set driver_approval = 'approved' where role = 'driver';

create index users_driver_approval_idx on public.users (driver_approval, created_at) where driver_approval is not null;

create table public.password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  token_hash text unique check (char_length(token_hash) between 32 and 128),
  issued_by uuid references public.users (id) on delete set null,
  issued_at timestamptz,
  expires_at timestamptz,
  used_at timestamptz,
  check ((token_hash is null) = (expires_at is null))
);
-- One open request per account: asking again refreshes it instead of piling up.
create unique index password_resets_one_open_idx on public.password_resets (user_id) where used_at is null;

alter table public.password_resets enable row level security;
revoke all on public.password_resets from anon, authenticated;

-- The audit log may now name a driver decision or a reset link; both are about a user.
