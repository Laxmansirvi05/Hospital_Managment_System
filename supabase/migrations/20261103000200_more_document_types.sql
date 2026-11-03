-- Documents may also be Word files (.docx) and WebP pictures, so a patient can give the assistant
-- whatever they have on their device (owner, 2026-11-03). Old Word .doc files are not accepted.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
where id = 'patient-documents';

alter table public.patient_files drop constraint patient_files_content_type_check;
alter table public.patient_files add constraint patient_files_content_type_check check (content_type in (
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
));
