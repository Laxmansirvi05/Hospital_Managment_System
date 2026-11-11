-- Sign in with Google is gone (owner, 2026-11-11). Dropping the column also drops its unique
-- constraint and the check that required a password or a Google id. Code that no longer reads the
-- column ships first, so applying this migration is safe at any time after that deploy.
alter table public.users drop column if exists google_sub;
