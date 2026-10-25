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
| `user_role` | `patient`, `driver`, `admin` | D-29 |
| `ambulance_type` | `BLS`, `ALS`, `ICU` | COLLECTION |
| `ambulance_status` | `available`, `offline`, `busy` | COLLECTION |
| `emergency_status` | `matching`, `assigned`, `en_route`, `arrived`, `picked_up`, `at_hospital`, `completed`, `cancelled`, plus a failed-match value (name OPEN, Q-06) | COLLECTION, OPEN |
| `emergency_type` | `cardiac`, `accident`, `other`, more OPEN | COLLECTION, OPEN (Q-05) |
| `triage_urgency` | `emergency`, `urgent`, `routine` | COLLECTION |
| `offer_state` | `open`, `accepted`, `expired`, `declined` | PROPOSED. `declined` is set by the driver's reject (D-32, P-20). |
| `listing_kind` | `hospital`, `doctor`, `pharmacy`, `diagnostic_centre`, `medicine` | PROPOSED (P-19) |

## 3. Tables

### users (designed for WP-1)

| Column | Notes |
| --- | --- |
| id | uuid |
| name | 1 to 100 characters |
| email | lower case, unique |
| phone | E.164, for example `+919876500000` |
| password_hash | `scrypt$N$r$p$salt$hash` (D-24) |
| role | `user_role`, default `patient` |
| disabled_at | set when the admin disables the account (P-22) |
| created_at, updated_at | |

### sessions (designed for WP-1, D-22)

| Column | Notes |
| --- | --- |
| id, user_id | one row per signed-in device |
| refresh_hash | SHA-256 of the current refresh token with a pepper. The token itself is never stored. |
| previous_refresh_hash | the rotated-out token, so reuse can be detected and the session revoked |
| created_at, last_used_at, expires_at | expiry moves forward 7 days on each refresh |
| revoked_at, revoked_reason | `logout`, `refresh_reuse` |

### rate_limits (designed for WP-1, D-25)

Fixed-window counters keyed by a SHA-256 hash of the kind and value, so no email or IP is stored in clear. Written by `hit_rate_limit(key, limit, window_seconds)`. pg_cron deletes rows older than a day.

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

### Listing columns (PROPOSED, P-19, P-24)

Every discovery table below has these columns. They are listed once here.

| Column | Notes |
| --- | --- |
| id, name | |
| description | optional, plain text |
| address, area | `area` is a Hyderabad locality used as a filter (D-27). For OpenStreetMap rows it is the nearest OSM suburb within 4 km, else the place's own suburb tag (D-50). The filter list is built from the data. When a place has no street address, `address` says so instead of guessing. |
| location | geography point, GiST index |
| phone, email, website | `phone` may be null (D-51). `email` only if publicly listed. `website` is an `https` or `http` URL. |
| source_ref | stable key from the source, such as `osm:node/123` or `care:/doctor/hyderabad/...`. Unique. Null only for the synthetic samples. Imports update by this key. |
| source_platform, source_url, checked_at | which online platform the data came from (D-35), the page address, and when it was last collected or checked (P-24) |
| active | boolean. Hidden listings are kept, not deleted. |
| search_vector | generated `tsvector` for full-text search, GIN index. Names also get a `pg_trgm` GIN index. |
| created_by, updated_by | admin user ids, for the audit trail |

Platform ratings are kept when a source publishes them; CareRoute's own reviews are in `reviews` (D-43). Sources: OpenStreetMap for hospitals, pharmacies and diagnostic centres (D-50), hospital websites for doctors (D-52), government data for prices (D-53). Data is loaded by `scripts/collect-*.js` and `scripts/load-listings.js`; where a scheduled job runs is OPEN (Q-28). One real place can appear on several platforms, so matching duplicates into one listing is needed (PROPOSED: match on normalized name plus distance under a small threshold, with admin review).

### hospitals

Listing columns, plus:

| Column | Notes |
| --- | --- |
| emergency_available | boolean or null. Null means the source does not say; it is never read as "no". |
| departments, specialities | text arrays |

Bed counts were removed (D-28, D-30). `hospital_staff` was removed with the `hospital_admin` role (D-29).

### doctors

Listing columns, plus:

| Column | Notes |
| --- | --- |
| hospital_id | nullable. A doctor may practise at a clinic instead. |
| clinic_name | when not linked to a hospital |
| title | the doctor's title as the hospital publishes it, for example "Senior Consultant Cardiologist" (D-54) |
| specialization, experience_years | `experience_years` may be null |
| appointment_phone | the hospital's appointment number for this doctor, as published. Never a personal number (D-54). |
| qualifications | text array |
| published_timings | text, only if officially published. Not live availability (D-28). |
| profile_url | official profile page |

The collection field `availableDays` from the old "Add doctor" request is replaced by `published_timings`. Doctor rows describe real people, so only the fields in D-54 are stored: no photo, no personal contact details.

### pharmacies (PROPOSED, P-19)

Listing columns only.

### diagnostic_centres (PROPOSED, P-19)

Listing columns, plus `tests_listed` (text array, only if publicly listed).

### medicines and medicine_listings (PROPOSED, P-19, D-35)

| Table | Columns |
| --- | --- |
| medicines | id, name, brand, form, strength, search_vector |
| medicine_listings | id, medicine_id, platform, price_inr (numeric, never negative), product_url, checked_at, active |

A price is shown with its platform and `checked_at`. CareRoute does not sell or order (D-28).

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
| ambulance_id | set during the trip. `destination_hospital_id` was removed (D-30). |
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

Append-only timeline of every step: created, offered, accepted, rejected, status changes, cancelled, SMS sent, report accessed. This powers the Care Thread, the audit trail and the analytics. Rows are never updated or deleted by application code.

### emergency_feedback

| Column | Notes |
| --- | --- |
| emergency_id (unique), rating 1 to 5, comment | allowed only when the emergency is `completed` |

### medical_reports (PROPOSED, Q-11)

See `08-medical-reports.md`. Hospital sharing was removed (D-29), so `report_shares` is no longer needed. A `share_with_crew` column is added only if Q-11 allows crew access. Report explanations are not stored by default (P-21).

### admin_audit (PROPOSED, P-22)

Append-only record of every admin action: admin id, action, target table and id, time. Listing edits keep the previous values so a wrong change can be traced.

### sms_outbox (PROPOSED)

Every SMS attempt: recipient phone, template name, status, provider response code, timestamps. No message body with health detail. Lets the dashboard and the runbook show whether SMS works.

## 4. Indexes

- `location` on every listing table, `ambulances.location`, `emergencies.patient_location`: GiST.
- `search_vector` on every listing table and `medicines`: GIN. Listing names: `pg_trgm` GIN.
- `emergencies (status)` partial index where status is not completed or cancelled, for the admin view (P-18).
- `emergencies (patient_user_id, created_at desc)` for history.
- `emergency_offers (state, expires_at)` for the expiry job.
- `emergency_events (emergency_id, created_at)`.

## 5. Database functions (PROPOSED)

| Function | Purpose |
| --- | --- |
| `accept_emergency(emergency_id, ambulance_id)` | Conditional update that succeeds only while the emergency is `matching` and the offer is open. Returns the row or nothing. |
| `expire_offers()` | Marks offers past `expires_at` as expired and opens the next ranked offer. Run by pg_cron. |
| `nearby_ambulances(point, type, radius_km)` | PostGIS filter used by matching and the admin view (P-18). |
| `nearby_hospitals(point, radius_km, emergency_only)` | Same for hospitals, returns distance in km. |
| `search_listings(kind, query, area, point, radius_km)` | Full-text and name search over one listing table, with optional distance. PROPOSED (P-19). |

## 6. Analytics queries (admin, P-18)

- `totalRequests`: count of emergencies in range.
- `avgAssignSeconds`: average of `assigned_at - created_at`.
- Response time by hour: average of `arrived_at - created_at`, grouped by hour of day. Time zone for grouping is OPEN. Use one fixed zone and state it on the chart.
- Failed matches: count of emergencies in the failed-match state (Q-06).
