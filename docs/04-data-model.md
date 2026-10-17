# Data model

Status: PROPOSED. Field names that appear in the Postman collection are kept exactly. Everything else is a design to be approved. Tables use snake_case in the database and camelCase in the API.

## 1. Conventions

- Primary keys are UUIDs. The collection shows prefixed ids such as `usr_123` and `em_123` in sample responses. Whether ids are prefixed in the API is OPEN. Do not depend on the prefix in code.
- Every table has `created_at`. Mutable tables also have `updated_at`.
- Locations use PostGIS `geography(Point, 4326)` with a GiST index. Latitude is in -90 to 90 and longitude in -180 to 180. Out-of-range input is rejected at the API with 422.
- Enums are real Postgres enums.
- Row Level Security is enabled on every table. No policy grants access to `anon` or `authenticated`. All access goes through the server.

## 2. Enums

| Enum | Values | Source |
| --- | --- | --- |
| `user_role` | `patient`, `driver`, `hospital_admin`, `dispatcher` | COLLECTION |
| `ambulance_type` | `BLS`, `ALS`, `ICU` | COLLECTION |
| `ambulance_status` | `available`, `offline`, `busy` | COLLECTION |
| `emergency_status` | `matching`, `assigned`, `en_route`, `arrived`, `picked_up`, `at_hospital`, `completed`, `cancelled`, plus a failed-match value (name OPEN, Q-06) | COLLECTION, OPEN |
| `emergency_type` | `cardiac`, `accident`, `other`, more OPEN | COLLECTION, OPEN (Q-05) |
| `triage_urgency` | `emergency`, `urgent`, `routine` | COLLECTION |
| `offer_state` | `open`, `accepted`, `expired`, `declined` | PROPOSED |

## 3. Tables

### users

| Column | Notes |
| --- | --- |
| id | |
| name, email, phone | email unique |
| password_hash | argon2id |
| role | `user_role` |
| created_at | |

### patient_profiles (medical ID)

| Column | Notes |
| --- | --- |
| user_id | one row per patient |
| blood_group | text, validated list |
| allergies | text array |
| medical_notes | text |
| share_with_crew | boolean, default false |

### emergency_contacts

| Column | Notes |
| --- | --- |
| id, user_id | |
| name, phone, relation | |

### hospitals

| Column | Notes |
| --- | --- |
| id, name, address, phone | |
| location | geography point, GiST index |
| emergency_available | boolean |
| departments | text array |
| icu_total, icu_available, general_total, general_available | integers, available never above total, never below zero (check constraints) |
| beds_updated_at | shown to users as "updated N minutes ago" |

### hospital_staff (PROPOSED, Q-02)

Links a `hospital_admin` user to a hospital. Without it there is no way to stop one admin editing another hospital.

### doctors

| Column | Notes |
| --- | --- |
| id, hospital_id | |
| name, specialization, experience_years | |
| qualifications | text array |
| available_days | text array |

### ambulances

| Column | Notes |
| --- | --- |
| id, driver_user_id | one or many per driver is OPEN (Q-03) |
| registration_number | unique |
| type, status | enums |
| operator_name, driver_phone | |
| location, heading_degrees, speed_kmph, last_ping_at | latest position, GiST index |

An ambulance with an old `last_ping_at` is treated as not available for matching. The threshold is OPEN.

### emergencies

| Column | Notes |
| --- | --- |
| id | |
| patient_user_id | null for guest SOS |
| guest_phone | set for guest SOS |
| for_self, emergency_type, conscious, patient_count | |
| ambulance_type, notes | |
| patient_location, patient_address | |
| status | `emergency_status` |
| ambulance_id, destination_hospital_id | set during the trip |
| eta_seconds | |
| tracking_token_hash | store a hash, return the token once at creation |
| cancel_reason | |
| created_at, assigned_at, arrived_at, completed_at | used by analytics |

### emergency_offers (PROPOSED)

| Column | Notes |
| --- | --- |
| id, emergency_id, ambulance_id | |
| rank, eta_seconds | rank from matching |
| state | `offer_state` |
| offered_at, expires_at | `expires_at` is `offered_at` plus 30 seconds |

One open offer per emergency at a time. A partial unique index enforces it.

### emergency_events (PROPOSED)

Append-only timeline of every step: created, offered, accepted, status changes, cancelled, pre-alert sent, SMS sent, report accessed. This powers the Care Thread, the audit trail and the analytics. Rows are never updated or deleted by application code.

### emergency_feedback

| Column | Notes |
| --- | --- |
| emergency_id (unique), rating 1 to 5, comment | allowed only when the emergency is `completed` |

### medical_reports and report_shares (PROPOSED, Q-11)

See `08-medical-reports.md`.

### sms_outbox (PROPOSED)

Every SMS attempt: recipient phone, template name, status, provider response code, timestamps. No message body with health detail. Lets the dashboard and the runbook show whether SMS works.

## 4. Indexes

- `hospitals.location`, `ambulances.location`, `emergencies.patient_location`: GiST.
- `emergencies (status)` partial index where status is not completed or cancelled, for the dispatcher view.
- `emergencies (patient_user_id, created_at desc)` for history.
- `emergency_offers (state, expires_at)` for the expiry job.
- `emergency_events (emergency_id, created_at)`.

## 5. Database functions (PROPOSED)

| Function | Purpose |
| --- | --- |
| `accept_emergency(emergency_id, ambulance_id)` | Conditional update that succeeds only while the emergency is `matching` and the offer is open. Returns the row or nothing. |
| `expire_offers()` | Marks offers past `expires_at` as expired and opens the next ranked offer. Run by pg_cron. |
| `nearby_ambulances(point, type, radius_km)` | PostGIS filter used by matching and the dispatcher view. |
| `nearby_hospitals(point, radius_km, emergency_only)` | Same for hospitals, returns distance in km. |

## 6. Analytics queries

- `totalRequests`: count of emergencies in range.
- `avgAssignSeconds`: average of `assigned_at - created_at`.
- Response time by hour: average of `arrived_at - created_at`, grouped by hour of day. Time zone for grouping is OPEN. Use one fixed zone and state it on the chart.
- Failed matches: count of emergencies in the failed-match state (Q-06).
