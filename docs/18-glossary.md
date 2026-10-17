# Glossary

| Term | Meaning |
| --- | --- |
| SOS | A request for an ambulance raised by a patient or a bystander. In the API this is an emergency. |
| Emergency | One SOS and everything that follows it, from request to completion or cancellation. |
| Guest SOS | An SOS raised without an account, using a phone number and location. |
| Patient | A registered user who can raise SOS requests, for themselves or for someone else. |
| Driver | A registered user who drives a registered ambulance. |
| Hospital admin | A user who manages one hospital's profile, doctors and beds. Role name `hospital_admin`. |
| Dispatcher | A user who watches all active cases and the analytics. |
| Family contact | A person saved by a patient as an emergency contact. Receives a tracking link by SMS. Has no account. |
| Tracking token | A random value in the family link that allows read-only access to one emergency's status, ambulance position and ETA. |
| BLS | Basic life support ambulance type. |
| ALS | Advanced life support ambulance type. |
| ICU | Intensive care ambulance type. Also the name of a hospital bed class. |
| ETA | Estimated time of arrival, in seconds in the API (`etaSeconds`). |
| Road ETA | ETA calculated along roads by the routing service, as opposed to straight-line distance. |
| Offer | A request that has been presented to one specific driver, valid for 30 seconds. |
| Matching | The process of ranking available ambulances and offering the SOS to them one at a time. |
| Pre-alert | The notice a hospital receives before an ambulance arrives, created when the driver marks the patient as picked up and names the destination. |
| Medical ID | A patient's blood group, allergies and notes. |
| Medical report | A file the patient uploads, such as a lab result, prescription or scan. |
| Triage | A first assessment of how urgent a described symptom is. Here it is guidance only. |
| Red flag | A symptom pattern that the fixed rule layer treats as an emergency regardless of what the model says. |
| Safety floor | The rule that a model can raise urgency but never lower what the rules decided. |
| Care Thread | The design concept and component that shows the patient, ambulance, hospital and reports for one case as a connected line. |
| PostGIS | The PostgreSQL extension used for distance and radius queries on locations. |
| RLS | Row Level Security, a PostgreSQL feature that restricts which rows a database role can read or write. |
| pg_cron | A PostgreSQL extension that runs scheduled database jobs. |
| Supabase Realtime | The live update service used for tracking. Replaces Socket.IO. |
| Adapter | A small module that hides a third-party service behind our own interface so it can be replaced or faked. |
| LOCKED, COLLECTION, PROPOSED, OPEN | Status labels defined in `00-decisions.md`. |
