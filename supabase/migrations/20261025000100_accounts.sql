-- Accounts, sessions and rate limits (WP-1; D-21 to D-25).

create type public.user_role as enum ('patient', 'driver', 'admin');

create table public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null unique check (email = lower(email) and char_length(email) <= 254),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  password_hash text not null check (password_hash like 'scrypt$%'),
  role public.user_role not null default 'patient',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  refresh_hash text not null,
  previous_refresh_hash text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_reason text check (revoked_reason in ('logout', 'refresh_reuse', 'disabled'))
);
create index sessions_user_idx on public.sessions (user_id);

-- Fixed-window counters keyed by a hash, so no email or IP is stored in clear (D-25).
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null check (count >= 0),
  created_at timestamptz not null default now()
);

create function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns table (allowed boolean, retry_after integer)
language plpgsql
set search_path = ''
as $$
declare
  r public.rate_limits;
begin
  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case when rl.window_start <= now() - make_interval(secs => p_window_seconds) then 1 else rl.count + 1 end,
        window_start = case when rl.window_start <= now() - make_interval(secs => p_window_seconds) then now() else rl.window_start end
  returning * into r;
  allowed := r.count <= p_limit;
  retry_after := case when allowed then 0
    else greatest(1, ceil(extract(epoch from (r.window_start + make_interval(secs => p_window_seconds) - now())))::integer) end;
  return next;
end;
$$;

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.rate_limits enable row level security;
revoke all on public.users, public.sessions, public.rate_limits from anon, authenticated;
revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;

select cron.schedule('careroute-rate-limits-cleanup', '17 3 * * *', $$delete from public.rate_limits where window_start < now() - interval '1 day'$$);
select cron.schedule('careroute-sessions-cleanup', '27 3 * * *', $$delete from public.sessions where expires_at < now() - interval '30 days'$$);
