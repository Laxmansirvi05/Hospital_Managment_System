-- Linking Google to an account ends its sessions (D-63); record why, alongside the existing reasons.
alter table public.sessions drop constraint sessions_revoked_reason_check;
alter table public.sessions add constraint sessions_revoked_reason_check
  check (revoked_reason in ('logout', 'refresh_reuse', 'disabled', 'google_link'));
