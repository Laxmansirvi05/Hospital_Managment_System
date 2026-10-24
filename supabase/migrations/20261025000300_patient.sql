-- Patient data: medical ID (D-39), contacts, reminders (D-38), appointment log (D-37),
-- documents and photo (D-06, P-26). Health data: never logged, never returned to anyone but
-- the owner, and to the crew only as P-25 describes once emergencies are built.

create table public.patient_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  purpose text not null check (purpose in ('document', 'photo')),
  title text not null check (char_length(title) between 1 and 120),
  kind text not null check (kind in ('lab', 'prescription', 'scan', 'discharge', 'insurance', 'other', 'photo')),
  file_name text not null,
  content_type text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  storage_path text not null unique,
  status text not null default 'pending' check (status in ('pending', 'ready')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index patient_files_user_idx on public.patient_files (user_id, purpose, created_at desc);

create table public.patient_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  date_of_birth date,
  gender text check (gender in ('female', 'male', 'other', 'prefer_not_to_say')),
  preferred_language text not null default '',
  address jsonb not null default '{}' check (jsonb_typeof(address) = 'object'),
  blood_group text check (blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Not known')),
  height_cm integer check (height_cm between 30 and 250),
  weight_kg numeric(5, 1) check (weight_kg between 1 and 350),
  allergies text[] not null default '{}',
  conditions text[] not null default '{}',
  current_medicines text[] not null default '{}',
  past_surgeries text[] not null default '{}',
  disabilities text[] not null default '{}',
  organ_donor text not null default 'undecided' check (organ_donor in ('yes', 'no', 'undecided')),
  medical_notes text not null default '' check (char_length(medical_notes) <= 500),
  insurance jsonb not null default '{}' check (jsonb_typeof(insurance) = 'object'),
  primary_doctor jsonb not null default '{}' check (jsonb_typeof(primary_doctor) = 'object'),
  share_with_crew boolean not null default false,
  photo_file_id uuid references public.patient_files (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  relation text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index emergency_contacts_user_idx on public.emergency_contacts (user_id);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  medicine_name text not null check (char_length(medicine_name) between 1 and 120),
  dose text not null,
  instructions text not null default '',
  times text[] not null check (cardinality(times) between 1 and 8),
  days_of_week smallint[] not null default '{0,1,2,3,4,5,6}' check (cardinality(days_of_week) between 1 and 7 and days_of_week <@ '{0,1,2,3,4,5,6}'),
  start_date date not null,
  end_date date check (end_date is null or end_date >= start_date),
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reminders_user_idx on public.reminders (user_id);

create table public.reminder_doses (
  reminder_id uuid not null references public.reminders (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  dose_date date not null,
  dose_time text not null check (dose_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  status text not null check (status in ('taken', 'skipped')),
  created_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  primary key (reminder_id, dose_date, dose_time)
);
create index reminder_doses_user_date_idx on public.reminder_doses (user_id, dose_date);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  doctor_name text not null,
  speciality text not null default '',
  place text not null,
  hospital_id uuid references public.hospitals (id) on delete set null,
  appointment_date date not null,
  appointment_time text not null check (appointment_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  reason text not null default '',
  notes text not null default '',
  status text not null default 'scheduled' check (status in ('scheduled', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index appointments_user_date_idx on public.appointments (user_id, appointment_date);

alter table public.patient_files enable row level security;
alter table public.patient_profiles enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.reminders enable row level security;
alter table public.reminder_doses enable row level security;
alter table public.appointments enable row level security;
revoke all on public.patient_files, public.patient_profiles, public.emergency_contacts, public.reminders, public.reminder_doses, public.appointments from anon, authenticated;

-- Private storage buckets (P-26). Files are reached only through signed links from the API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('patient-documents', 'patient-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png']),
  ('patient-photos', 'patient-photos', false, 2097152, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;
