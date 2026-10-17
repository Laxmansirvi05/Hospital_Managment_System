# API specification

Source of truth: `postman/ambulance-platform.postman_collection.json`. Section 1 to 3 restate it. Section 4 is new and PROPOSED. If this file and the collection disagree, fix this file, or ask the owner before changing the collection.

Base path: `/api/v1`. Local base URL in the collection: `http://localhost:4000/api/v1`. JSON everywhere. Protected routes need `Authorization: Bearer <token>`.

"Role" is the token the collection uses for that request. Where the collection uses one role's token, other roles are expected to get 403. Ownership rules are added in `09-security.md` section 5.

## 1. Endpoint catalogue

### 0. Health

| Method and path | Auth | Success | Notes |
| --- | --- | --- | --- |
| GET `/health` | none | 200 `{ status: "ok" }` | Checks API and database. |

### 1. Auth

| Method and path | Auth | Request body | Success |
| --- | --- | --- | --- |
| POST `/auth/register` | none | `name`, `email`, `phone`, `password`, `role` | 201 `{ token, user: { id, role, name } }`. 409 if the email exists. See Q-01. |
| POST `/auth/login` | none | `email`, `password` | 200 `{ token, ... }` |
| GET `/auth/me` | any role | none | 200 user including `role` |

### 2. Patient medical ID and contacts

| Method and path | Role | Request body | Success |
| --- | --- | --- | --- |
| PUT `/patients/me/medical-id` | patient | `bloodGroup`, `allergies[]`, `medicalNotes`, `shareWithCrew` | 200 the saved medical ID |
| GET `/patients/me/medical-id` | patient | none | 200 the medical ID |
| POST `/patients/me/contacts` | patient | `name`, `phone`, `relation` | 201 `{ id, ... }` |
| GET `/patients/me/contacts` | patient | none | 200 `{ contacts: [] }` |
| DELETE `/patients/me/contacts/{id}` | patient | none | 204 |

### 3. Hospitals, doctors and beds

| Method and path | Role | Request | Success |
| --- | --- | --- | --- |
| POST `/hospitals` | hospital_admin | `name`, `address`, `lat`, `lng`, `phone`, `emergencyAvailable`, `departments[]`, `beds { icuTotal, icuAvailable, generalTotal, generalAvailable }` | 201 `{ id, name, emergencyAvailable }` |
| GET `/hospitals/nearby` | patient | query `lat`, `lng`, `radiusKm`, `emergencyOnly` | 200 `{ hospitals: [{ ..., distanceKm }] }` sorted nearest first |
| GET `/hospitals/{id}` | patient | none | 200 hospital with departments and beds |
| POST `/hospitals/{id}/doctors` | hospital_admin | `name`, `specialization`, `experienceYears`, `qualifications[]`, `availableDays[]` | 201 `{ id, ... }` |
| GET `/hospitals/{id}/doctors` | patient | query `specialization` optional | 200 `{ doctors: [] }` |
| PATCH `/hospitals/{id}/beds` | hospital_admin | `icuAvailable`, `generalAvailable` | 200 `{ beds: { icuAvailable, ... } }` |

### 4. Ambulances

| Method and path | Role | Request | Success |
| --- | --- | --- | --- |
| POST `/ambulances` | driver | `registrationNumber`, `type`, `operatorName`, `driverPhone` | 201 `{ id, ... }` |
| PATCH `/ambulances/{id}/status` | driver | `status`: `available`, `offline`, `busy` | 200 `{ status }` |
| POST `/ambulances/{id}/location` | driver | `lat`, `lng`, `headingDegrees`, `speedKmph` | 200 `{ ok: true }` |
| GET `/ambulances/nearby` | dispatcher | query `lat`, `lng`, `type`, `radiusKm` | 200 `{ ambulances: [] }` nearest first |

### 5. Emergencies

| Method and path | Role | Request | Success |
| --- | --- | --- | --- |
| POST `/emergencies` | patient | `patientLocation { lat, lng, address? }`, `forSelf`, `emergencyType`, `conscious`, `patientCount`, `ambulanceType`, `notes` | 201 `{ id, status, trackingToken, etaSeconds, createdAt }`. Status is `matching` or `assigned`. |
| POST `/emergencies/guest` | none | `phone`, `patientLocation`, `emergencyType`, `ambulanceType` | 201 includes `trackingToken` |
| GET `/emergencies/{id}` | patient | none | 200 `{ id, status, ambulance, etaSeconds, ... }` |
| GET `/emergencies/mine` | patient | none | 200 `{ emergencies: [] }` newest first |
| GET `/emergencies/driver/inbox` | driver | none | 200 `{ offers: [] }` each with `id` |
| POST `/emergencies/{id}/accept` | driver | none | 200 `{ status: "assigned", etaSeconds }`. 409 if not acceptable. 403 for non-drivers. |
| PATCH `/emergencies/{id}/status` | driver | `status`; with `picked_up` also `destinationHospitalId` | 200 `{ status, destinationHospitalId? }` |
| GET `/emergencies/{id}/track` | none | query `token` | 200 `{ status, ambulance position, ETA }`. No medical data. |
| GET `/emergencies/{id}/recommended-hospitals` | driver | none | 200 `{ hospitals: [{ score, reason, ... }] }` |
| GET `/hospitals/{id}/incoming` | hospital_admin | none | 200 `{ incoming: [{ emergencyId, ... }] }` |
| POST `/emergencies/{id}/feedback` | patient | `rating` 1 to 5, `comment` | 201 `{ rating, ... }`. Only after completion. |
| POST `/emergencies/{id}/cancel` | patient | `reason` | 200 `{ status: "cancelled" }`. Only before pickup. |

Driver status values used in the trip, in order: `en_route`, `arrived`, `picked_up`, `at_hospital`, `completed`.

### 6. Assistant

| Method and path | Role | Request | Success |
| --- | --- | --- | --- |
| POST `/assistant/triage` | patient | `message`, `age`, `language` | 200 `{ urgency, sosRecommended, suggestedSpecialty, disclaimer }` |

### 7. Dispatch and analytics

| Method and path | Role | Request | Success |
| --- | --- | --- | --- |
| GET `/dispatch/active` | dispatcher | none | 200 `{ emergencies: [] }` |
| GET `/dispatch/analytics/summary` | dispatcher | query `from`, `to` (dates) | 200 `{ totalRequests, avgAssignSeconds, ... }` |
| GET `/dispatch/analytics/response-times` | dispatcher | query `groupBy=hour` | 200 `{ series: [] }` |

## 2. Negative cases required by the collection

| Case | Expected |
| --- | --- |
| Latitude 200 on `POST /emergencies` | 422, response text mentions "location" |
| `GET /emergencies/mine` without a token | 401 |
| Patient calls `POST /emergencies/{id}/accept` | 403 |
| Driver accepts an already completed emergency | 409 |
| Register an email that exists | 409 |
| Any request | Responds in under 2 seconds |

## 3. Realtime contract

| Item | Value | Source |
| --- | --- | --- |
| Channel name | `emergency:<id>` | COLLECTION (was a Socket.IO room, now a Supabase Realtime channel, see D-11) |
| Events | location update, status change, offer, pre-alert | PROPOSED names, to be fixed in WP-5 |
| Authorization | OPEN (Q-14) | |

## 4. Medical reports (PROPOSED, P-11)

Not in the collection. If approved, add these requests and tests to the collection in WP-9.

| Method and path | Role | Purpose |
| --- | --- | --- |
| POST `/patients/me/reports` | patient | Create a report record and return a one-time signed upload URL. Body: `title`, `kind`, `fileName`, `contentType`, `sizeBytes`. |
| POST `/patients/me/reports/{id}/complete` | patient | Confirm the upload finished so the server can verify the stored file. |
| GET `/patients/me/reports` | patient | List own reports: `{ reports: [] }`. |
| GET `/patients/me/reports/{id}/download` | patient | Return a short-lived signed download URL. |
| DELETE `/patients/me/reports/{id}` | patient | Delete the record and the file. 204. |
| PUT `/patients/me/reports/{id}/sharing` | patient | Set what is shared: `shareWithCrew`, `shareWithHospitalIds[]`. |
| GET `/hospitals/{id}/incoming/{emergencyId}/reports` | hospital_admin | List reports the patient shared for a case routed to this hospital. |
| GET `/hospitals/{id}/incoming/{emergencyId}/reports/{reportId}/download` | hospital_admin | Signed download URL. Writes an access event. |

## 5. Rules that apply to every endpoint

1. The request is validated against a Zod schema before any other work.
2. Role and ownership are checked before any data is read.
3. Responses contain only fields the caller may see. The public tracking response is a separate type, so medical data cannot be added to it by accident.
4. Secrets, tokens, password hashes and other users' data never appear in a response or a log.
5. A route with no test for 401, 403 and the happy path is not finished.
