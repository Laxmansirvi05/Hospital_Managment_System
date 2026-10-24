-- Discovery listings (D-35, D-36, P-19, P-24). Read only for users; written by admins and the
-- collection job. Every listing keeps its source platform and the date it was checked.

create table public.hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text not null,
  address text not null,
  location extensions.geography(point, 4326) not null,
  description text not null default '',
  phone text not null,
  email text,
  website text check (website is null or website ~ '^https?://'),
  emergency_available boolean not null default false,
  specialities text[] not null default '{}',
  departments text[] not null default '{}',
  rating numeric(2, 1) check (rating between 0 and 5),
  rating_count integer check (rating_count >= 0),
  source_platform text not null,
  source_url text check (source_url is null or source_url ~ '^https?://'),
  checked_at date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialization text not null,
  qualifications text[] not null default '{}',
  experience_years integer check (experience_years between 0 and 70),
  hospital_id uuid references public.hospitals (id) on delete set null,
  clinic_name text,
  clinic_area text,
  clinic_address text,
  clinic_phone text,
  clinic_location extensions.geography(point, 4326),
  published_timings text not null default '',
  profile_url text check (profile_url is null or profile_url ~ '^https?://'),
  rating numeric(2, 1) check (rating between 0 and 5),
  rating_count integer check (rating_count >= 0),
  source_platform text not null,
  source_url text check (source_url is null or source_url ~ '^https?://'),
  checked_at date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (hospital_id is not null or (clinic_name is not null and clinic_location is not null))
);

create table public.pharmacies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text not null,
  address text not null,
  location extensions.geography(point, 4326) not null,
  phone text not null,
  email text,
  website text check (website is null or website ~ '^https?://'),
  hours text not null default '',
  open_24 boolean not null default false,
  rating numeric(2, 1) check (rating between 0 and 5),
  rating_count integer check (rating_count >= 0),
  source_platform text not null,
  source_url text check (source_url is null or source_url ~ '^https?://'),
  checked_at date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.diagnostic_centres (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text not null,
  address text not null,
  location extensions.geography(point, 4326) not null,
  description text not null default '',
  phone text not null,
  email text,
  website text check (website is null or website ~ '^https?://'),
  hours text not null default '',
  tests_listed text[] not null default '{}',
  rating numeric(2, 1) check (rating between 0 and 5),
  rating_count integer check (rating_count >= 0),
  source_platform text not null,
  source_url text check (source_url is null or source_url ~ '^https?://'),
  checked_at date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  form text not null,
  pack text not null,
  prescription_required boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.medicine_listings (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references public.medicines (id) on delete cascade,
  platform text not null,
  price_inr numeric(10, 2) not null check (price_inr >= 0),
  product_url text not null check (product_url ~ '^https?://'),
  checked_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (medicine_id, platform)
);

create index hospitals_location_idx on public.hospitals using gist (location);
create index pharmacies_location_idx on public.pharmacies using gist (location);
create index diagnostic_centres_location_idx on public.diagnostic_centres using gist (location);
create index doctors_clinic_location_idx on public.doctors using gist (clinic_location);
create index doctors_hospital_idx on public.doctors (hospital_id);
create index medicine_listings_medicine_idx on public.medicine_listings (medicine_id);
create index hospitals_name_trgm on public.hospitals using gin (name extensions.gin_trgm_ops);
create index doctors_name_trgm on public.doctors using gin (name extensions.gin_trgm_ops);
create index pharmacies_name_trgm on public.pharmacies using gin (name extensions.gin_trgm_ops);
create index diagnostic_centres_name_trgm on public.diagnostic_centres using gin (name extensions.gin_trgm_ops);
create index medicines_name_trgm on public.medicines using gin (name extensions.gin_trgm_ops);

alter table public.hospitals enable row level security;
alter table public.doctors enable row level security;
alter table public.pharmacies enable row level security;
alter table public.diagnostic_centres enable row level security;
alter table public.medicines enable row level security;
alter table public.medicine_listings enable row level security;
revoke all on public.hospitals, public.doctors, public.pharmacies, public.diagnostic_centres, public.medicines, public.medicine_listings from anon, authenticated;
