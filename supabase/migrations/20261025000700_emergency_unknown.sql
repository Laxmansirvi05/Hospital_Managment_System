-- OpenStreetMap rarely tags whether a hospital has an emergency department. "Not tagged" is not
-- "no", and telling a patient a hospital has no emergency department when it does is unsafe.
-- Null now means unknown; the page says the source does not list it.

alter table public.hospitals alter column emergency_available drop not null;
alter table public.hospitals alter column emergency_available drop default;
update public.hospitals set emergency_available = null where source_platform = 'OpenStreetMap' and emergency_available = false;
