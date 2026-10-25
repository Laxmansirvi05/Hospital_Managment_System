-- More published doctor details from hospital websites (D-55 to D-57). The photo is the
-- hospital's own image address; CareRoute never stores the image itself.

alter table public.doctors add column photo_url text check (photo_url is null or photo_url ~ '^https://');
alter table public.doctors add column languages text[] not null default '{}';
alter table public.doctors add column expertise text[] not null default '{}';
alter table public.doctors add column booking_url text check (booking_url is null or booking_url ~ '^https://');
alter table public.doctors add column consultation_fee_inr numeric(8, 2) check (consultation_fee_inr is null or consultation_fee_inr >= 0);

create index doctors_specialization_trgm on public.doctors using gin (specialization extensions.gin_trgm_ops);
