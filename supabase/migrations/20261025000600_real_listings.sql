-- Real listing data (D-50 to D-54). OpenStreetMap places often have no phone (D-51), so phone
-- becomes optional. Every imported row keeps a stable key from its source, so a later import
-- updates the same row instead of adding a copy. Doctors gain the fields D-54 publishes.

alter table public.hospitals alter column phone drop not null;
alter table public.pharmacies alter column phone drop not null;
alter table public.diagnostic_centres alter column phone drop not null;

alter table public.hospitals add column source_ref text;
alter table public.pharmacies add column source_ref text;
alter table public.diagnostic_centres add column source_ref text;
alter table public.doctors add column source_ref text;

create unique index hospitals_source_ref_key on public.hospitals (source_ref);
create unique index pharmacies_source_ref_key on public.pharmacies (source_ref);
create unique index diagnostic_centres_source_ref_key on public.diagnostic_centres (source_ref);
create unique index doctors_source_ref_key on public.doctors (source_ref);

alter table public.doctors add column title text not null default '' check (char_length(title) <= 160);
-- The hospital's appointment desk for this doctor, as the hospital publishes it. Never a personal number (D-54).
alter table public.doctors add column appointment_phone text;

create index hospitals_area_idx on public.hospitals (area);
create index pharmacies_area_idx on public.pharmacies (area);
create index diagnostic_centres_area_idx on public.diagnostic_centres (area);
