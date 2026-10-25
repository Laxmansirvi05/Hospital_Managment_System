-- Real medicine data from government sources (D-53). The Jan Aushadhi list gives generic name,
-- pack, MRP and therapeutic group, but not whether a prescription is needed, so that becomes
-- unknown (null) rather than a wrong "no".

alter table public.medicines alter column prescription_required drop not null;
alter table public.medicines alter column prescription_required drop default;
alter table public.medicines add column source_ref text;
alter table public.medicines add column category text;
create unique index medicines_source_ref_key on public.medicines (source_ref);
create index medicines_category_idx on public.medicines (category) where active;
