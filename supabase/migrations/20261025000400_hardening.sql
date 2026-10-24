-- Hardening from the security review of 2026-10-25.

-- L2: the five-contact cap holds under parallel requests. A per-user advisory lock serialises
-- inserts for one patient; other patients are not blocked.
create function public.enforce_contact_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if (select count(*) from public.emergency_contacts where user_id = new.user_id) >= 5 then
    raise exception 'contact_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_contact_limit() from public, anon, authenticated;

create trigger emergency_contacts_limit
  before insert on public.emergency_contacts
  for each row execute function public.enforce_contact_limit();

-- M2: upload records that never completed are removed after a day. Their storage objects, if
-- any were written, must be removed through the Storage API; that job is not built yet.
select cron.schedule('careroute-pending-files-cleanup', '37 3 * * *', $$delete from public.patient_files where status = 'pending' and created_at < now() - interval '1 day'$$);
