# API specification

Source of truth: `postman/ambulance-platform.postman_collection.json`. Sections 1 to 3 restate it. Sections 4 to 8 are new and PROPOSED. If this file and the collection disagree, fix this file, or ask the owner before changing the collection.

The collection was changed on 2026-10-24 (D-34) to remove the `hospital_admin` and `dispatcher` requests, hospital creation, doctor creation, bed updates, hospital recommendations, pre-alerts and the destination hospital. Folder 7 is now the edge-case folder.

Base path: `/api/v1`. Local base URL in the collection: `http://localhost:4000/api/v1`. JSON everywhere. Protected routes need `Authorization: Bearer <token>` or the session cookie (D-23).

"Role" is the token the collection uses for that request. Where the collection uses one role's token, other roles are expected to get 403. Ownership rules are added in `09-security.md` section 5.

Roles: `patient`, `driver`, `admin` (D-29).

## 1. Endpoint catalogue (collection)

### 0. Health

| Method and path | Auth | Success | Notes |
| --- | --- | --- | --- |
| GET `/health` | none | 200 `{ status: "ok" }` | Checks API and database. |

### 1. Auth

| Method and path | Auth | Request body | Success |
| --- | --- | --- | --- |
| POST `/auth/register` | none | `name`, `email`, `phone`, `password`, `role` | 201 `{ token, user: { id, role, name } }`. 409 if the email exists. |
| POST `/auth/login` | none | `email`, `password` | 200 `{ token, ... }` |
| GET `/auth/me` | any role | none | 200 `{ id, name, email, phone, role, createdAt }`, role at the top level as the collection reads it |
| POST `/auth/refresh` | refresh cookie | none | 200 `{ token, user }` and new cookies. Rotates the refresh token. 401 if unknown, expired, revoked or reused. New (D-22). |
| POST `/auth/logout` | any role | none | 204, session revoked, cookies cleared. New (D-22). |

Auth rules decided for WP-1 (designed, not built on `main`):

- Register and login also set two httpOnly cookies: `cr_access` (15 minutes, path `/`) and `cr_refresh` (7 days, path `/api/v1/auth`). The JSON `token` is the same access token, for API clients (D-22, D-23).
- `role` defaults to `patient`. `driver` and `admin` return 403 `role_not_allowed` unless `ALLOW_PRIVILEGED_SIGNUP=true` (D-21, D-29).
- Email is stored lower case. A 10-digit Indian mobile number becomes `+91` followed by the number. Other numbers must be in `+` country code form (PROPOSED).
- Passwords are 8 to 128 characters (PROPOSED, NIST SP 800-63B minimum).
- Wrong password and unknown email give the same 401 `invalid_credentials`.
- An expired access token gives 401 `token_expired`, so the browser knows to refresh.
- Too many attempts give 429 `rate_limited` with `Retry-After` (D-25).
- Writes authenticated by cookie need the same `Origin` and the header `x-careroute-csrf: 1`, otherwise 403 `csrf_failed` (D-23).

### 2. Patient medical ID and contacts

| Method and path | Role | Request body | Success |
| --- | --- | --- | --- |
| PUT `/patients/me/medical-id` | patient | `bloodGroup`, `allergies[]`, `medicalNotes`, `shareWithCrew` | 200 the saved medical ID |
| GET `/patients/me/medical-id` | patient | none | 200 the medical ID |
| POST `/patients/me/contacts` | patient | `name`, `phone`, `relation` | 201 `{ id, ... }` |
| GET `/patients/me/contacts` | patient | none | 200 `{ contacts: [] }` |
| DELETE `/patients/me/contacts/{id}` | patient | none | 204 |

### 3. Hospital and doctor discovery

Hospitals and doctors are listing data managed by the admin (section 7). The collection reads them from seed data, so the database must hold at least one hospital near the sample coordinates.

| Method and path | Role | Request | Success |
| --- | --- | --- | --- |
| GET `/hospitals/nearby` | patient | query `lat`, `lng`, `radiusKm`, `emergencyOnly` | 200 `{ hospitals: [{ ..., distanceKm }] }` sorted nearest first. The collection stores the first id as `hospitalId`. |
| GET `/hospitals/{id}` | patient | none | 200 hospital with departments and public details |
| GET `/hospitals/{id}/doctors` | patient | query `specialization` optional | 200 `{ doctors: [] }` |

Whether these work without signing in is OPEN (Q-27). The collection sends a patient token.

### 4. Ambulances

| Method and path | Role | Request | Success |
| --- | --- | --- | --- |
| POST `/ambulances` | driver | `registrationNumber`, `type`, `operatorName`, `driverPhone` | 201 `{ id, ... }` |
| PATCH `/ambulances/{id}/status` | driver | `status`: `available`, `offline`, `busy` | 200 `{ status }` |
| POST `/ambulances/{id}/location` | driver | `lat`, `lng`, `headingDegrees`, `speedKmph` | 200 `{ ok: true }` |

### 5. Emergencies

| Method and path | Role | Request | Success |
| --- | --- | --- | --- |
| POST `/emergencies` | patient | `patientLocation { lat, lng, address? }`, `forSelf`, `emergencyType`, `conscious`, `patientCount`, `ambulanceType`, `notes` | 201 `{ id, status, trackingToken, etaSeconds, createdAt }`. Status is `matching` or `assigned`. |
| POST `/emergencies/guest` | none | `phone`, `patientLocation`, `emergencyType`, `ambulanceType` | 201 includes `trackingToken` |
| GET `/emergencies/{id}` | patient | none | 200 `{ id, status, ambulance, etaSeconds, ... }` |
| GET `/emergencies/mine` | patient | none | 200 `{ emergencies: [] }` newest first |
| GET `/emergencies/driver/inbox` | driver | none | 200 `{ offers: [] }` each with `id` |
| POST `/emergencies/{id}/accept` | driver | none | 200 `{ status: "assigned", etaSeconds }`. 409 if not acceptable. 403 for non-drivers. |
| PATCH `/emergencies/{id}/status` | driver | `status` | 200 `{ status }`. `picked_up` takes no destination (D-30). |
| GET `/emergencies/{id}/track` | none | query `token` | 200 `{ status, ambulance position, ETA }`. No medical data. |
| POST `/emergencies/{id}/feedback` | patient | `rating` 1 to 5, `comment` | 201 `{ rating, ... }`. Only after completion. |
| POST `/emergencies/{id}/cancel` | patient | `reason` | 200 `{ status: "cancelled" }`. Only before pickup. |

Driver status values used in the trip, in order: `en_route`, `arrived`, `picked_up`, `at_hospital`, `completed`.

### 6. Assistant: triage

| Method and path | Role | Request | Success |
| --- | --- | --- | --- |
| POST `/assistant/triage` | patient | `message`, `age`, `language` | 200 `{ urgency, sosRecommended, suggestedSpecialty, disclaimer }` |

### 7. Edge cases and negative tests

| Case | Expected |
| --- | --- |
| Guest SOS without login | 201 with `trackingToken` |
| Raise and cancel a second SOS | 201, then 200 `cancelled` |
| Latitude 200 on `POST /emergencies` | 422, response text mentions "location" |
| `GET /emergencies/mine` without a token | 401 |
| Patient calls `POST /emergencies/{id}/accept` | 403 |
| Driver accepts an already completed emergency | 409 |
| Register an email that exists | 409 |
| Any request | Responds in under 2 seconds |

## 2. Realtime contract

| Item | Value | Source |
| --- | --- | --- |
| Channel name | `emergency:<id>` | COLLECTION (was a Socket.IO room, now a Supabase Realtime channel, see D-11) |
| Events | location update, status change, offer | PROPOSED names, to be fixed in WP-5 |
| Authorization | OPEN (Q-14) | |

## 3. Shared rules for listing responses (PROPOSED, P-19, P-24)

- Every listing has `id`, `name`, `kind`, `address`, `area`, `location { lat, lng }`, `phone` (may be `null`, D-51), `email` (only if public), `website`, `sourcePlatform`, `sourceUrl`, `checkedAt`.
- Hospitals have `emergencyAvailable`: `true`, `false`, or `null` when the source does not say. `emergencyOnly` returns only `true`.
- Doctors also have `title` (string, may be empty, D-54). A doctor's `place.phone` is the hospital's appointment number for that doctor when published, else the hospital's main number.
- `rating` and `reviewCount` appear only once Q-24 is decided. Until then they are absent, not zero.
- Search endpoints accept `q`, `area`, `lat`, `lng`, `radiusKm`, `limit` and `cursor`. They return `{ <plural>: [], nextCursor }`. With `lat` and `lng`, each item has `distanceKm` and results are nearest first unless `sort` says otherwise.
- Only listings marked active by the admin are returned.

## 4. Discovery (PROPOSED, P-19)

Not in the collection. Data comes from online platforms such as Apollo, MedPlus and Tata 1mg (D-35). Collection method is OPEN (Q-28). Sign-in requirement is OPEN (Q-27).

| Method and path | Purpose |
| --- | --- |
| GET `/hospitals` | Search hospitals. Extra filters: `speciality`, `department`, `emergencyOnly`. |
| GET `/doctors` | Search doctors without choosing a hospital. Filters: `specialization`, `hospitalId`. Returns profiles with `qualifications`, `experienceYears`, `hospital` or `clinic`, `publishedTimings` (only if officially published), `profileUrl`. |
| GET `/doctors/{id}` | One doctor profile. |
| GET `/pharmacies` | Search pharmacies and medical stores. |
| GET `/pharmacies/{id}` | One pharmacy. |
| GET `/diagnostic-centres` | Search diagnostic centres and labs. Filter: `test`. |
| GET `/diagnostic-centres/{id}` | One centre with `testsListed` if public. |
| GET `/medicines` | Search by medicine name. Returns `{ medicines: [{ id, name, brand, form, strength, listings: [{ platform, priceInr, rating?, productUrl, checkedAt }] }] }`, listings sorted by price. |

## 5. Assistant: discovery and report explanation (PROPOSED, P-21, P-23)

| Method and path | Role | Purpose |
| --- | --- | --- |
| POST `/assistant/discover` | patient | Body: `message`, `area?`, `lat?`, `lng?`. Returns `{ suggestedSpecialty, facilityTypes[], results: { doctors, hospitals, pharmacies, diagnosticCentres, medicines }, disclaimer }`. Results come only from CareRoute's own search. |
| POST `/patients/me/reports/{id}/explain` | patient | Returns `{ summary, terms: [{ term, meaning }], values: [{ name, value, unit, referenceRange, flaggedByReport }], questionsForDoctor[], disclaimer }`. Blocked by Q-25. Not stored by default. |

Both follow the safety limits in D-33 and `07-ai-triage.md`.

## 6. Emergencies: driver reject (PROPOSED, P-20)

| Method and path | Role | Purpose |
| --- | --- | --- |
| POST `/emergencies/{id}/reject` | driver | The driver's open offer becomes `declined` and the next ranked offer opens. 200 `{ offerState: "declined" }`. 409 if the driver has no open offer for this emergency. |

## 7. Admin (PROPOSED, P-18, P-22)

All routes need the `admin` role.

| Method and path | Purpose |
| --- | --- |
| GET `/admin/users` | List accounts: `id`, `name`, `email`, `role`, `createdAt`, `disabled`. Never medical data. |
| PATCH `/admin/users/{id}` | Disable or enable an account. |
| POST, PATCH `/admin/listings/{kind}` and `/admin/listings/{kind}/{id}` | Create and edit a hospital, doctor, pharmacy, diagnostic centre or medicine listing. `kind` is one of `hospitals`, `doctors`, `pharmacies`, `diagnostic-centres`, `medicines`. |
| PATCH `/admin/listings/{kind}/{id}/visibility` | Hide or show a listing. Listings are hidden, not deleted, so the history of what was shown is kept. |
| GET `/admin/emergencies/active` | Former `GET /dispatch/active`: every emergency not completed or cancelled (P-18). |
| GET `/admin/ambulances/nearby` | Former `GET /ambulances/nearby`: query `lat`, `lng`, `type`, `radiusKm` (P-18). |
| GET `/admin/analytics/summary` | Former `GET /dispatch/analytics/summary`: query `from`, `to`. Returns `totalRequests`, `avgAssignSeconds` (P-18). |
| GET `/admin/analytics/response-times` | Former `GET /dispatch/analytics/response-times`: query `groupBy=hour`. Returns `series` (P-18). |

## 8. Medical reports (PROPOSED, P-11)

Not in the collection. If approved, add these requests and tests to the collection in WP-9.

| Method and path | Role | Purpose |
| --- | --- | --- |
| POST `/patients/me/reports` | patient | Create a report record and return a one-time signed upload URL. Body: `title`, `kind`, `fileName`, `contentType`, `sizeBytes`. |
| POST `/patients/me/reports/{id}/complete` | patient | Confirm the upload finished so the server can verify the stored file. |
| GET `/patients/me/reports` | patient | List own reports: `{ reports: [] }`. |
| GET `/patients/me/reports/{id}/download` | patient | Return a short-lived signed download URL. |
| DELETE `/patients/me/reports/{id}` | patient | Delete the record and the file. 204. |
| PUT `/patients/me/reports/{id}/sharing` | patient | Set `shareWithCrew`. Exists only if Q-11 allows crew access. |

## 9. Rules that apply to every endpoint

1. The request is validated against a Zod schema before any other work.
2. Role and ownership are checked before any data is read.
3. Responses contain only fields the caller may see. The public tracking response is a separate type, so medical data cannot be added to it by accident.
4. Secrets, tokens, password hashes and other users' data never appear in a response or a log.
5. A route with no test for 401, 403 and the happy path is not finished.
6. Outbound links in responses (`website`, `profileUrl`, `productUrl`, `sourceUrl`) are `https` or `http` URLs only, validated when the admin saves them.

## 10. Built on 2026-10-25 (D-36 to D-41)

Implemented on `main`. Not in the Postman collection yet; add them with the owner's approval.

| Method and path | Role | Purpose |
| --- | --- | --- |
| GET `/config` | none | Allow-listed public values and `dataMode` (`sample` or `live`) |
| GET, PUT `/patients/me/medical-id` | patient | Expanded medical ID (D-39). PUT is a partial update; the collection's four fields still work. Response adds `age`, `hasPhoto`, `completeness`. |
| POST `/patients/me/photo`, POST `/patients/me/photo/{id}/complete`, GET and DELETE `/patients/me/photo` | patient | Photo upload with a one-time link, byte check, short-lived view link (P-26) |
| GET, POST `/patients/me/reminders`; PATCH, DELETE `/patients/me/reminders/{id}` | patient | Medicine reminders (D-38): `medicineName`, `dose`, `instructions`, `times[]`, `daysOfWeek[]`, `startDate`, `endDate`, `notes`, `active` |
| GET `/patients/me/reminders/today?date=` | patient | Doses due on a date with status `due`, `taken` or `skipped` |
| POST `/patients/me/reminders/{id}/doses` | patient | Record `taken` or `skipped` for `date` and `time` |
| GET, POST `/patients/me/appointments`; PATCH, DELETE `/patients/me/appointments/{id}` | patient | Appointment log (D-37). CareRoute does not book. |
| GET `/patients/me/dashboard?date=` | patient | Dashboard in one call (D-40) |
| GET `/areas` | signed in | Hyderabad areas for filters, built from the active listings (sorted by name). The `area` search parameter accepts any text up to 80 characters; an unknown area returns an empty list, not an error. |
| GET `/hospitals`, `/doctors`, `/doctors/{id}`, `/medicines`, `/medicines/{id}`, `/pharmacies`, `/pharmacies/{id}`, `/diagnostic-centres`, `/diagnostic-centres/{id}` | signed in | The three search areas (D-36), with `lat` and `lng` for nearest first |

Section 8 (reports) is built with `kind` values `lab`, `prescription`, `scan`, `discharge`, `insurance`, `other`, and limits PDF, JPEG or PNG up to 10 MB (PROPOSED until Q-11).

### Added later on 2026-10-25 (D-43, D-45)

| Method and path | Role | Purpose |
| --- | --- | --- |
| POST `/auth/password` | any role | `currentPassword`, `newPassword`. 204. Ends every other session. |
| POST `/auth/sessions/revoke-others` | any role | Sign out on all other devices. 204. |
| POST `/patients/me/delete-account` | patient | `password`, `confirm: "DELETE"`. Removes stored files, then the account and all its data (D-45). 204, cookies cleared. 502 `delete_incomplete` if storage fails, in which case nothing is deleted. |
| GET `/reviews?kind=&id=` | signed in | `kind` is `hospital`, `doctor`, `pharmacy` or `diagnostic_centre`. Returns `{ summary: { average, count }, reviews: [{ id, rating, body, author, updatedAt, mine }] }`. `author` is a first name only. |
| PUT `/reviews` | patient | `kind`, `id`, `rating` 1 to 5, `body` up to 1,000 characters. Creates or updates the caller's one review for that listing. |
| DELETE `/reviews/{id}` | patient | Own review only. 204. |
| POST `/reviews/{id}/report` | patient | Not your own. Three reports from different patients hide it until an admin checks (P-28). 204. |
