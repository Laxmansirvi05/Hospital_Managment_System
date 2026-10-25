# Privacy and data handling

This document sets the rules for personal and health data. It is a project policy, not legal advice. Before any use with real people, have the obligations reviewed by a qualified professional. India's Digital Personal Data Protection Act, 2023 is likely to apply to data about people in India, and health data deserves the strictest treatment either way.

## 1. Demo data rule

The demo runs on synthetic data only. No real patient, driver, hospital or report is used in development, previews or the demo. Seed data in `supabase/seed.sql` is invented. Exception: listing and medicine data is real public information. Hospitals, pharmacies and diagnostic centres come from OpenStreetMap (D-50), medicine prices from government data (D-53), and doctor profiles from the hospitals' own websites with only the fields in D-54. Patient, driver, emergency and report data stay synthetic. The only real phone numbers are the few verified test numbers the Twilio trial needs, and they belong to people who agreed.

## 2. Data inventory

| Data | Class | Where | Who sees it |
| --- | --- | --- | --- |
| Name, email, phone | Personal | `users` | Owner, and limited use by crew on an active case |
| Password hash | Credential | `users` | Nobody |
| Blood group, allergies, notes | Health | `patient_profiles` | Owner, crew if shared |
| Medical report files | Health | Storage bucket | See `08-medical-reports.md` |
| Emergency contacts | Personal (of a third party) | `emergency_contacts` | Owner, SMS sender |
| Patient location during an SOS | Location | `emergencies` | Parties on the case |
| Ambulance location | Location | `ambulances`, Realtime | Parties on the case, admin (P-18) |
| Emergency type, condition, notes | Health | `emergencies` | Parties on the case |
| Feedback | Personal | `emergency_feedback` | Admin in aggregate (P-18), owner |
| SMS records | Personal | `sms_outbox` | Operators |
| Triage and discovery assistant text | Health | Not stored by default | Sent to a model provider, see 5 |
| Report content sent for explanation | Health | Not stored by default | Sent to a model provider, blocked by Q-25 |
| Business listings: hospitals, pharmacies, diagnostic centres, medicine prices | Public business information | Listing tables | Everyone who can search |
| Doctor profiles | Personal data of real people, from public sources | `doctors` | Everyone who can search. Taken from online platforms (D-35). What may be published and the removal process OPEN (Q-22). |
| Admin actions | Operational | `admin_audit` | Admins, owner |

## 3. Principles

1. Collect only what a feature in the PRD needs.
2. Health data is shared only by the patient's choice (`shareWithCrew`, report sharing), except the facts the crew needs to run the trip that the patient or caller entered during the SOS.
3. Family contacts get a tracking link, never health data.
4. The platform admin sees accounts, listings and, if P-18 is approved, the operational picture of emergencies. Never medical ID, reports or emergency notes.
5. Every person can see, correct and delete their data (see section 6).
6. Plain-language notices, written for a stressed reader, shown at the moment of the choice.

## 4. Consent screens

| Moment | What the screen must say | Default |
| --- | --- | --- |
| Saving medical ID | Who can see it: the ambulance crew assigned to you, only during an emergency | Share off |
| Adding an emergency contact | They will get an SMS with a tracking link when you raise an SOS | Required for the feature |
| Uploading a report | The file is private until you share it | Share off |
| Sharing a report | Exactly who will see it and when | Nothing shared |
| Triage and discovery assistant | Your text is sent to an AI service to produce guidance. Do not enter names or phone numbers. | Notice shown before first use |
| Report explanation | This report will be sent to an AI service to explain it. It is guidance, not a diagnosis. | Asked each time, before sending |
| Leaving CareRoute | You are going to {provider}'s website. CareRoute does not handle bookings, orders or payments. | Shown on outbound links |
| Location | Why the app needs your location and that it is used only while you raise or follow an SOS | Browser permission prompt, asked at the moment of use |

Consent text is part of the product and follows `12-ux-and-content.md`.

## 5. Third parties

| Service | Receives | Must not receive |
| --- | --- | --- |
| Gemini, Groq, OpenRouter | Symptom text, age, language. Discovery assistant text. Report content, only after Q-25. | Name, phone, email, location, user id |
| Mapbox | Coordinates of ambulances and the patient, for routing | Names, phone numbers, medical data |
| Provider websites (outbound links) | Whatever the user chooses to send them after leaving CareRoute. CareRoute adds no tracking parameters. | Anything from CareRoute |
| Hospital websites' image hosts (D-55): CARE, KIMS, Rainbow and Gleneagles (on AWS S3), Continental, Ankura, Citizens, L V Prasad | Image requests from the browser, which reveal the visitor's IP and which doctor's photo is loaded. The request carries no CareRoute address (`referrerpolicy="no-referrer"`). | Anything else. Owner to confirm this flow is accepted with D-55; the alternative is serving photos through the API (PROPOSED). |
| MapTiler | Tile requests from the browser, which reveal the viewed area and the browser's IP | Anything else |
| Twilio | Contact phone number, message text with the tracking link | Health detail |
| Supabase | All stored data | Not applicable, it is the data store. Choose the project region deliberately (OPEN). |
| Vercel | Request traffic and logs | Not applicable. Keep logs redacted. |

Each provider's terms about retention and model training must be checked and recorded here before real data is used (Q-17).

## 6. User rights as features (PROPOSED)

| Right | Feature |
| --- | --- |
| See my data | Profile page lists medical ID, contacts, emergency history, reports, and who viewed reports |
| Correct my data | Edit screens for medical ID and contacts |
| Delete my data | Delete reports one by one. Account deletion removes profile, contacts, reports and personal fields. Emergency history handling is OPEN. |
| Withdraw consent | Turn off `shareWithCrew` and report sharing at any time. Takes effect immediately. |
| Export | A downloadable copy of the data. Format OPEN. |

## 7. Retention (OPEN, Q-10)

Periods are not decided. They must be set for: emergencies and events, ambulance position history, SMS records, feedback, reports, logs and backups. Until set, position history beyond the active case is not kept, and logs are kept only as long as the host's default.

## 8. Location handling

- Ask for browser location at the point of use, not on first page load.
- If permission is denied, offer manual address entry. An SOS must never be blocked by a location denial.
- Patient location is visible to the assigned driver and, if P-18 is approved, the admin, and to nobody else.
- Discovery uses location only to sort by distance. It is sent with the search request and not stored.
- The public tracking page shows the ambulance, not the patient's address.

## 9. Incidents involving personal data

A suspected exposure of personal or health data follows the runbook in `17-observability-and-runbook.md`. Reporting duties to regulators and to affected people depend on law and must be checked with a professional (OPEN).
