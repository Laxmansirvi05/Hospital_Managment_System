# Glossary

| Term | Meaning |
| --- | --- |
| SOS | A request for an ambulance raised by a patient or a bystander. In the API this is an emergency. |
| Emergency | One SOS and everything that follows it, from request to completion or cancellation. |
| Guest SOS | An SOS raised without an account, using a phone number and location. |
| Patient | A registered user who can raise SOS requests, for themselves or for someone else. |
| Driver | A registered user who drives a registered ambulance. |
| Platform admin | CareRoute operations staff who manage users and listing data. Role name `admin`. |
| Family contact | A person saved by a patient as an emergency contact. Receives a tracking link by SMS. Has no account. |
| Tracking token | A random value in the family link that allows read-only access to one emergency's status, ambulance position and ETA. |
| BLS | Basic life support ambulance type. |
| ALS | Advanced life support ambulance type. |
| ICU | Intensive care ambulance type. |
| ETA | Estimated time of arrival, in seconds in the API (`etaSeconds`). |
| Road ETA | ETA calculated along roads by the routing service, as opposed to straight-line distance. |
| Offer | A request that has been presented to one specific driver, valid for 30 seconds. |
| Matching | The process of ranking available ambulances and offering the SOS to them one at a time. |
| Medical ID | A patient's blood group, allergies and notes. |
| Medical report | A file the patient uploads, such as a lab result, prescription or scan. |
| Triage | A first assessment of how urgent a described symptom is. Here it is guidance only. |
| Discovery | Finding hospitals, doctors, medicines, pharmacies and diagnostic centres in CareRoute and going to the provider for the next step. |
| Listing | One hospital, doctor, pharmacy, diagnostic centre or medicine entry in CareRoute's discovery data, with its source and checked date. |
| Medicine listing | One platform's listed price and product link for a medicine. CareRoute does not sell it. |
| Diagnostic centre | A diagnostic centre, pathology lab or testing centre. |
| Report explanation | The assistant's plain-language explanation of a report's terms and values. Not a diagnosis. |
| Reject | A driver turning down an offer. The next ranked ambulance gets it at once. |
| Red flag | A symptom pattern that the fixed rule layer treats as an emergency regardless of what the model says. |
| Safety floor | The rule that a model can raise urgency but never lower what the rules decided. |
| Care Thread | The design concept and component that shows the patient, ambulance and reports for one case as a connected line. |
| PostGIS | The PostgreSQL extension used for distance and radius queries on locations. |
| RLS | Row Level Security, a PostgreSQL feature that restricts which rows a database role can read or write. |
| pg_cron | A PostgreSQL extension that runs scheduled database jobs. |
| Supabase Realtime | The live update service used for tracking. Replaces Socket.IO. |
| Adapter | A small module that hides a third-party service behind our own interface so it can be replaced or faked. |
| LOCKED, COLLECTION, PROPOSED, OPEN | Status labels defined in `00-decisions.md`. |
