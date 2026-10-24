-- Foundation: extensions and default privileges.
-- All access goes through the API with the server role. The public anon key must read nothing
-- (docs/09-security.md section 2), so new objects in public grant nothing to anon or authenticated.

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pg_cron;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;
