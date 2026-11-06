-- Emergency (ambulance) system, synthetic demo (D-72 to D-79, docs/06-emergency-lifecycle.md).
-- Tables: ambulances, emergencies, emergency_offers, emergency_events, emergency_feedback.
-- Moves are made by SQL functions so each one is one transaction: row lock, conditional update,
-- one emergency_events row. Only the API role (careroute_api) may call them.

create type public.ambulance_type as enum ('BLS', 'ALS', 'ICU');
create type public.ambulance_status as enum ('available', 'offline', 'busy');
create type public.emergency_status as enum ('matching', 'assigned', 'en_route', 'arrived', 'picked_up', 'at_hospital', 'completed', 'cancelled', 'no_match');
create type public.emergency_type as enum ('cardiac', 'accident', 'breathing', 'stroke', 'pregnancy', 'other');
create type public.offer_state as enum ('queued', 'open', 'accepted', 'expired', 'declined');

-- ---------------------------------------------------------------------------------------------
-- ambulances: one ambulance per driver account (D-73). Demo crews have no account (D-72, D-78).
-- ---------------------------------------------------------------------------------------------
create table public.ambulances (
  id uuid primary key default gen_random_uuid(),
  driver_user_id uuid unique references public.users (id) on delete set null,
  registration_number text not null unique check (char_length(registration_number) between 4 and 20),
  type public.ambulance_type not null,
  status public.ambulance_status not null default 'offline',
  operator_name text not null check (char_length(operator_name) between 1 and 100),
  driver_name text check (char_length(driver_name) between 1 and 100),
  driver_phone text check (driver_phone ~ '^\+[1-9][0-9]{7,14}$'),
  is_demo boolean not null default false,
  location extensions.geography(point, 4326),
  heading_degrees smallint check (heading_degrees between 0 and 359),
  speed_kmph numeric(5, 1) check (speed_kmph between 0 and 250),
  last_ping_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'offline' or (location is not null and last_ping_at is not null)),
  check (not is_demo or driver_user_id is null)
);
create index ambulances_location_idx on public.ambulances using gist (location);
create index ambulances_available_idx on public.ambulances (type) where status = 'available';

-- ---------------------------------------------------------------------------------------------
-- emergencies
-- ---------------------------------------------------------------------------------------------
create table public.emergencies (
  id uuid primary key default gen_random_uuid(),
  patient_user_id uuid references public.users (id) on delete cascade,
  guest_phone text check (guest_phone ~ '^\+[1-9][0-9]{7,14}$'),
  for_self boolean not null default true,
  emergency_type public.emergency_type not null default 'other',
  conscious boolean,
  patient_count smallint not null default 1 check (patient_count between 1 and 20),
  ambulance_type public.ambulance_type not null default 'BLS',
  notes text check (char_length(notes) <= 500),
  patient_location extensions.geography(point, 4326) not null,
  patient_address text check (char_length(patient_address) <= 300),
  status public.emergency_status not null default 'matching',
  ambulance_id uuid references public.ambulances (id) on delete set null,
  eta_seconds integer check (eta_seconds >= 0),
  eta_is_estimate boolean not null default true,
  offers_made smallint not null default 0,
  tracking_token_hash text not null unique check (char_length(tracking_token_hash) between 32 and 128),
  tracking_expires_at timestamptz not null default now() + interval '24 hours',
  cancel_reason text check (char_length(cancel_reason) <= 200),
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  assigned_at timestamptz,
  en_route_at timestamptz,
  arrived_at timestamptz,
  picked_up_at timestamptz,
  at_hospital_at timestamptz,
  completed_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (patient_user_id is not null or guest_phone is not null)
);
create index emergencies_active_idx on public.emergencies (status) where status not in ('completed', 'cancelled', 'no_match');
create index emergencies_patient_idx on public.emergencies (patient_user_id, created_at desc);
create index emergencies_ambulance_idx on public.emergencies (ambulance_id) where ambulance_id is not null;
create index emergencies_location_idx on public.emergencies using gist (patient_location);
create index emergencies_guest_purge_idx on public.emergencies (closed_at) where patient_user_id is null;

-- ---------------------------------------------------------------------------------------------
-- emergency_offers: ranked by matching, only one open at a time (D-74).
-- ---------------------------------------------------------------------------------------------
create table public.emergency_offers (
  id uuid primary key default gen_random_uuid(),
  emergency_id uuid not null references public.emergencies (id) on delete cascade,
  ambulance_id uuid not null references public.ambulances (id) on delete cascade,
  rank smallint not null check (rank between 1 and 5),
  eta_seconds integer check (eta_seconds >= 0),
  state public.offer_state not null default 'queued',
  offered_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (emergency_id, rank),
  unique (emergency_id, ambulance_id),
  check ((state = 'open') = (expires_at is not null and offered_at is not null) or state in ('accepted', 'expired', 'declined'))
);
create unique index emergency_offers_one_open_idx on public.emergency_offers (emergency_id) where state = 'open';
create index emergency_offers_expiry_idx on public.emergency_offers (expires_at) where state = 'open';
create index emergency_offers_ambulance_idx on public.emergency_offers (ambulance_id, state);

-- ---------------------------------------------------------------------------------------------
-- emergency_events: append-only timeline.
-- ---------------------------------------------------------------------------------------------
create table public.emergency_events (
  id uuid primary key default gen_random_uuid(),
  emergency_id uuid not null references public.emergencies (id) on delete cascade,
  kind text not null check (kind in ('created', 'offered', 'accepted', 'declined', 'expired', 'status_changed', 'cancelled', 'no_match', 'sms_sent', 'sms_failed', 'feedback', 'report_accessed')),
  actor_role text check (actor_role in ('patient', 'guest', 'driver', 'admin', 'system', 'demo_crew')),
  actor_user_id uuid references public.users (id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create index emergency_events_emergency_idx on public.emergency_events (emergency_id, created_at);
create index emergency_events_actor_idx on public.emergency_events (actor_user_id) where actor_user_id is not null;

create function public.emergency_events_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'emergency_events is append-only' using errcode = '23514';
end $$;
create trigger emergency_events_no_update before update on public.emergency_events
  for each row execute function public.emergency_events_append_only();

-- ---------------------------------------------------------------------------------------------
-- emergency_feedback: only for a completed emergency.
-- ---------------------------------------------------------------------------------------------
create table public.emergency_feedback (
  emergency_id uuid primary key references public.emergencies (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);

create function public.emergency_feedback_requires_completed() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.emergencies e where e.id = new.emergency_id and e.status = 'completed') then
    raise exception 'feedback is allowed only for a completed emergency' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger emergency_feedback_completed before insert on public.emergency_feedback
  for each row execute function public.emergency_feedback_requires_completed();

-- Same posture as the other tables (D-49): RLS on, no policies, nothing for anon or authenticated.
alter table public.ambulances enable row level security;
alter table public.emergencies enable row level security;
alter table public.emergency_offers enable row level security;
alter table public.emergency_events enable row level security;
alter table public.emergency_feedback enable row level security;
revoke all on public.ambulances, public.emergencies, public.emergency_offers, public.emergency_events, public.emergency_feedback from anon, authenticated;
-- Application code never changes or removes timeline rows. Cascades from a deleted emergency or
-- account run with the table owner's rights, so account deletion (D-45) still works.
revoke update, delete on public.emergency_events from careroute_api;

-- ---------------------------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------------------------

-- Candidates for matching (D-74): available, within the radius, able to serve the type (an ICU or
-- ALS unit may serve a lower type), and with a ping no older than p_max_age_seconds. Demo crews
-- (D-78) are always treated as fresh because the server moves them.
create function public.nearby_ambulances(
  p_point extensions.geography,
  p_type public.ambulance_type default 'BLS',
  p_radius_km numeric default 10,
  p_max_age_seconds integer default 90,
  p_limit integer default 24
) returns table (id uuid, type public.ambulance_type, distance_m double precision, is_demo boolean)
language sql stable set search_path = '' as $$
  select a.id, a.type, extensions.st_distance(a.location, p_point), a.is_demo
  from public.ambulances a
  where a.status = 'available'
    and a.type >= p_type
    and a.location is not null
    and extensions.st_dwithin(a.location, p_point, p_radius_km * 1000)
    and (a.is_demo or a.last_ping_at > now() - make_interval(secs => p_max_age_seconds))
  order by extensions.st_distance(a.location, p_point)
  limit least(greatest(p_limit, 1), 24)
$$;

-- Opens the next queued offer for 30 seconds (D-12, D-74). With none left the emergency moves to
-- no_match. Callers hold the emergency row lock.
create function public.open_next_offer(p_emergency_id uuid) returns public.emergency_offers
language plpgsql set search_path = '' as $$
declare
  v_offer public.emergency_offers;
begin
  update public.emergency_offers o
     set state = 'open', offered_at = now(), expires_at = now() + interval '30 seconds'
   where o.id = (select q.id from public.emergency_offers q where q.emergency_id = p_emergency_id and q.state = 'queued' order by q.rank limit 1)
  returning o.* into v_offer;
  if found then
    update public.emergencies set offers_made = offers_made + 1, updated_at = now() where id = p_emergency_id;
    insert into public.emergency_events (emergency_id, kind, actor_role, data)
      values (p_emergency_id, 'offered', 'system', jsonb_build_object('ambulance_id', v_offer.ambulance_id, 'rank', v_offer.rank));
    return v_offer;
  end if;
  update public.emergencies
     set status = 'no_match', closed_at = now(), updated_at = now(),
         tracking_expires_at = least(created_at + interval '24 hours', now() + interval '2 hours')
   where id = p_emergency_id and status = 'matching';
  if found then
    insert into public.emergency_events (emergency_id, kind, actor_role) values (p_emergency_id, 'no_match', 'system');
  end if;
  return null;
end $$;

-- Stores the ranked candidates the server chose, at most five, and opens the first. An empty list
-- means no match. Safe to call twice. p_candidates: [{"ambulance_id": "...", "eta_seconds": 420}, ...]
create function public.create_offers(p_emergency_id uuid, p_candidates jsonb, p_eta_is_estimate boolean default true)
returns public.emergencies
language plpgsql set search_path = '' as $$
declare
  v_em public.emergencies;
  v_item jsonb;
  v_rank smallint := 0;
begin
  select * into v_em from public.emergencies where id = p_emergency_id and status = 'matching' for update;
  if not found then return null; end if;
  if exists (select 1 from public.emergency_offers where emergency_id = p_emergency_id) then return v_em; end if;
  update public.emergencies set eta_is_estimate = p_eta_is_estimate where id = p_emergency_id;
  for v_item in select value from jsonb_array_elements(coalesce(p_candidates, '[]'::jsonb)) limit 5 loop
    v_rank := v_rank + 1;
    insert into public.emergency_offers (emergency_id, ambulance_id, rank, eta_seconds, state)
      values (p_emergency_id, (v_item ->> 'ambulance_id')::uuid, v_rank, nullif(v_item ->> 'eta_seconds', '')::integer, 'queued');
  end loop;
  perform public.open_next_offer(p_emergency_id);
  select * into v_em from public.emergencies where id = p_emergency_id;
  return v_em;
end $$;

-- A driver accepts. Works only while the emergency is matching and this ambulance holds the open,
-- unexpired offer. Returns the emergency, or null when the accept did not happen.
create function public.accept_emergency(p_emergency_id uuid, p_ambulance_id uuid) returns public.emergencies
language plpgsql set search_path = '' as $$
declare
  v_em public.emergencies;
  v_offer public.emergency_offers;
begin
  select * into v_em from public.emergencies where id = p_emergency_id and status = 'matching' for update;
  if not found then return null; end if;
  perform 1 from public.ambulances where id = p_ambulance_id and status = 'available' for update;
  if not found then return null; end if;
  update public.emergency_offers set state = 'accepted'
   where emergency_id = p_emergency_id and ambulance_id = p_ambulance_id and state = 'open' and expires_at > now()
  returning * into v_offer;
  if not found then return null; end if;
  update public.ambulances set status = 'busy', updated_at = now() where id = p_ambulance_id;
  update public.emergency_offers set state = 'expired' where emergency_id = p_emergency_id and state in ('queued', 'open');
  update public.emergencies
     set status = 'assigned', ambulance_id = p_ambulance_id, assigned_at = now(), updated_at = now(),
         eta_seconds = coalesce(v_offer.eta_seconds, eta_seconds)
   where id = p_emergency_id
  returning * into v_em;
  insert into public.emergency_events (emergency_id, kind, actor_role, data)
    values (p_emergency_id, 'accepted', 'driver', jsonb_build_object('ambulance_id', p_ambulance_id));
  return v_em;
end $$;

-- A driver rejects the open offer (D-32). The next queued offer opens at once.
create function public.decline_offer(p_emergency_id uuid, p_ambulance_id uuid) returns public.emergencies
language plpgsql set search_path = '' as $$
declare
  v_em public.emergencies;
begin
  select * into v_em from public.emergencies where id = p_emergency_id and status = 'matching' for update;
  if not found then return null; end if;
  update public.emergency_offers set state = 'declined'
   where emergency_id = p_emergency_id and ambulance_id = p_ambulance_id and state = 'open';
  if not found then return null; end if;
  insert into public.emergency_events (emergency_id, kind, actor_role, data)
    values (p_emergency_id, 'declined', 'driver', jsonb_build_object('ambulance_id', p_ambulance_id));
  perform public.open_next_offer(p_emergency_id);
  select * into v_em from public.emergencies where id = p_emergency_id;
  return v_em;
end $$;

-- Run by pg_cron every few seconds (D-12). Expires open offers past their time and opens the next.
create function public.expire_offers() returns integer
language plpgsql set search_path = '' as $$
declare
  v_id uuid;
  v_ambulance uuid;
  v_count integer := 0;
begin
  for v_id in
    select e.id from public.emergencies e
     where e.status = 'matching'
       and exists (select 1 from public.emergency_offers o where o.emergency_id = e.id and o.state = 'open' and o.expires_at <= now())
     order by e.created_at
       for update skip locked
  loop
    update public.emergency_offers set state = 'expired'
     where emergency_id = v_id and state = 'open' and expires_at <= now()
    returning ambulance_id into v_ambulance;
    if found then
      insert into public.emergency_events (emergency_id, kind, actor_role, data)
        values (v_id, 'expired', 'system', jsonb_build_object('ambulance_id', v_ambulance));
      perform public.open_next_offer(v_id);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

-- The assigned ambulance moves the trip one step forward. Anything else returns null (D-30: no
-- destination hospital; picked_up takes no extra data).
create function public.advance_emergency(p_emergency_id uuid, p_ambulance_id uuid, p_to public.emergency_status)
returns public.emergencies
language plpgsql set search_path = '' as $$
declare
  v_from public.emergency_status;
  v_em public.emergencies;
begin
  v_from := case p_to
    when 'en_route' then 'assigned'::public.emergency_status
    when 'arrived' then 'en_route'::public.emergency_status
    when 'picked_up' then 'arrived'::public.emergency_status
    when 'at_hospital' then 'picked_up'::public.emergency_status
    when 'completed' then 'at_hospital'::public.emergency_status
    else null end;
  if v_from is null then return null; end if;
  update public.emergencies
     set status = p_to, updated_at = now(),
         en_route_at = case when p_to = 'en_route' then now() else en_route_at end,
         arrived_at = case when p_to = 'arrived' then now() else arrived_at end,
         picked_up_at = case when p_to = 'picked_up' then now() else picked_up_at end,
         at_hospital_at = case when p_to = 'at_hospital' then now() else at_hospital_at end,
         completed_at = case when p_to = 'completed' then now() else completed_at end,
         closed_at = case when p_to = 'completed' then now() else closed_at end,
         tracking_expires_at = case when p_to = 'completed' then least(created_at + interval '24 hours', now() + interval '2 hours') else tracking_expires_at end
   where id = p_emergency_id and ambulance_id = p_ambulance_id and status = v_from
  returning * into v_em;
  if not found then return null; end if;
  insert into public.emergency_events (emergency_id, kind, actor_role, data)
    values (p_emergency_id, 'status_changed', 'driver', jsonb_build_object('from', v_from, 'to', p_to));
  return v_em;
end $$;

-- Cancel before pickup. Frees the ambulance and closes any waiting offers. The caller has already
-- proved who the patient is (account or tracking token).
create function public.cancel_emergency(p_emergency_id uuid, p_reason text default null) returns public.emergencies
language plpgsql set search_path = '' as $$
declare
  v_em public.emergencies;
begin
  update public.emergencies
     set status = 'cancelled', cancel_reason = left(p_reason, 200), closed_at = now(), updated_at = now(),
         tracking_expires_at = least(created_at + interval '24 hours', now() + interval '2 hours')
   where id = p_emergency_id and status in ('matching', 'assigned', 'en_route', 'arrived')
  returning * into v_em;
  if not found then return null; end if;
  update public.emergency_offers set state = 'expired' where emergency_id = p_emergency_id and state in ('queued', 'open');
  if v_em.ambulance_id is not null then
    update public.ambulances set status = 'available', updated_at = now() where id = v_em.ambulance_id and status = 'busy';
  end if;
  insert into public.emergency_events (emergency_id, kind, actor_role, data)
    values (p_emergency_id, 'cancelled', 'patient', jsonb_build_object('reason', left(p_reason, 200)));
  return v_em;
end $$;

-- After a trip the driver chooses when to be offered work again (docs/06 section 4).
create function public.release_ambulance(p_ambulance_id uuid) returns boolean
language plpgsql set search_path = '' as $$
begin
  update public.ambulances a set status = 'available', updated_at = now()
   where a.id = p_ambulance_id and a.status = 'busy' and a.location is not null
     and not exists (select 1 from public.emergencies e where e.ambulance_id = a.id and e.status in ('assigned', 'en_route', 'arrived', 'picked_up', 'at_hospital'));
  return found;
end $$;

-- Guest SOS has no account to delete, so these records leave after 30 days (D-79).
create function public.purge_guest_emergencies() returns integer
language plpgsql set search_path = '' as $$
declare
  v_count integer;
begin
  delete from public.emergencies where patient_user_id is null and closed_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function
  public.emergency_events_append_only(),
  public.emergency_feedback_requires_completed(),
  public.nearby_ambulances(extensions.geography, public.ambulance_type, numeric, integer, integer),
  public.open_next_offer(uuid),
  public.create_offers(uuid, jsonb, boolean),
  public.accept_emergency(uuid, uuid),
  public.decline_offer(uuid, uuid),
  public.expire_offers(),
  public.advance_emergency(uuid, uuid, public.emergency_status),
  public.cancel_emergency(uuid, text),
  public.release_ambulance(uuid),
  public.purge_guest_emergencies()
from public, anon, authenticated;
grant execute on function
  public.nearby_ambulances(extensions.geography, public.ambulance_type, numeric, integer, integer),
  public.create_offers(uuid, jsonb, boolean),
  public.accept_emergency(uuid, uuid),
  public.decline_offer(uuid, uuid),
  public.expire_offers(),
  public.advance_emergency(uuid, uuid, public.emergency_status),
  public.cancel_emergency(uuid, text),
  public.release_ambulance(uuid)
to careroute_api;

select cron.schedule('careroute-expire-offers', '10 seconds', $$select public.expire_offers()$$);
select cron.schedule('careroute-guest-emergencies-purge', '47 3 * * *', $$select public.purge_guest_emergencies()$$);
