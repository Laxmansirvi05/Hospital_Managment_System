-- Published prices of diagnostic tests (blood tests, scans) from diagnostic chains' own
-- websites (D-56). A price is for the city, not one centre, as the chains publish it.

create table public.test_prices (
  id uuid primary key default gen_random_uuid(),
  source_ref text not null unique,
  provider text not null,
  name text not null check (char_length(name) between 1 and 300),
  category text,
  price_inr numeric(10, 2) not null check (price_inr >= 0),
  centres_offering integer check (centres_offering >= 0),
  url text not null check (url ~ '^https://'),
  checked_at date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index test_prices_name_trgm on public.test_prices using gin (name extensions.gin_trgm_ops);
create index test_prices_provider_idx on public.test_prices (provider) where active;

alter table public.test_prices enable row level security;
revoke all on public.test_prices from anon, authenticated;
