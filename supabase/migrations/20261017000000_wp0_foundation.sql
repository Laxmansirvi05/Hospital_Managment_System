-- WP-0 foundation. docs/04-data-model.md section 1 and docs/09-security.md section 8.

-- Location queries (nearby hospitals and ambulances) and the offer expiry job.
create extension if not exists postgis with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- The browser never talks to the database. The anon and authenticated roles get no
-- privileges on anything created in public from now on. All access goes through the API.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;

-- Backstop for the rule "Row Level Security on every table": any table created in
-- public gets RLS turned on, even if a migration forgets.
create or replace function public.enforce_rls_on_new_tables()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  obj record;
begin
  for obj in
    select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and schema_name = 'public'
  loop
    execute format('alter table %s enable row level security', obj.object_identity);
  end loop;
end;
$$;

drop event trigger if exists enforce_rls_on_new_tables;
create event trigger enforce_rls_on_new_tables
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.enforce_rls_on_new_tables();
