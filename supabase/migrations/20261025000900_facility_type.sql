-- Hospitals, clinics, nursing homes and dental and eye clinics share one table (D-59); the type
-- says which, so patients can tell a multispeciality hospital from a neighbourhood clinic.

alter table public.hospitals add column facility_type text not null default 'hospital'
  check (facility_type in ('hospital', 'clinic', 'nursing_home', 'dental', 'eye', 'maternity', 'ayush'));
create index hospitals_facility_type_idx on public.hospitals (facility_type) where active;

alter table public.pharmacies add column chain text;
