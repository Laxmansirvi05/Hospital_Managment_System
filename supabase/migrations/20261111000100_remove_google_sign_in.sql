-- Sign in with Google is gone (owner, 2026-11-11). Removes its column and index. Code that no longer
-- reads the column ships first, so applying this migration is safe at any time after that deploy.
drop index if exists public.users_google_sub_key;
alter table public.users drop column if exists google_sub;
