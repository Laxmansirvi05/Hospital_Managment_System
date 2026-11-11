-- Indexes for foreign keys that had none (Supabase performance advisor, 2026-11-12). Deleting a user
-- or a hospital checks these columns, and the admin screens join on them.
create index if not exists admin_audit_log_actor_idx on public.admin_audit_log (actor_user_id);
create index if not exists appointments_hospital_idx on public.appointments (hospital_id);
create index if not exists assistant_messages_user_idx on public.assistant_messages (user_id);
create index if not exists password_resets_issued_by_idx on public.password_resets (issued_by);
create index if not exists patient_profiles_photo_file_idx on public.patient_profiles (photo_file_id);
create index if not exists review_reports_user_idx on public.review_reports (user_id);
create index if not exists users_driver_reviewed_by_idx on public.users (driver_reviewed_by);
