# Product requirements: CareRoute

Status of this document: draft for owner approval. Anything not traceable to the Postman collection or the decision log is marked PROPOSED or OPEN.

## 1. Purpose

CareRoute connects four parties during a medical emergency: the patient, the ambulance, the hospital, and the patient's medical reports. When someone raises an SOS, the system finds the nearest suitable ambulance, tells the patient and their family where it is, warns the receiving hospital before arrival, and gives the crew the medical information the patient agreed to share.

## 2. Problem

During an emergency, people lose time on three things: reaching an ambulance, knowing where it is, and getting the right hospital ready. Hospitals usually learn about a patient at the door. Families wait without information. Crews often have no medical history.

CareRoute removes each of those gaps with one shared view of the case.

## 3. Goals

1. A patient or a bystander can raise an SOS in very few steps, with or without an account.
2. The best available ambulance is offered the job automatically, ranked by road ETA and vehicle type.
3. The patient and family see live status and ETA.
4. The receiving hospital sees an incoming patient before arrival.
5. Patients keep a medical ID, emergency contacts and medical reports, and choose what the crew can see.
6. Dispatchers see every active case and the numbers that show whether the service is working.

## 4. Non-goals

- Diagnosis. The assistant gives guidance only.
- Native mobile apps (D-02).
- Languages other than English (D-05).
- WhatsApp or any channel other than SMS (D-17).
- Payments and billing. Not in the collection.
- Integration with real hospital information systems (D-04).
- Manual dispatcher assignment. The collection has no endpoint for it. If wanted, it is a new feature (see Q-07).

## 5. Users

| Role | Who | Main job |
| --- | --- | --- |
| Patient | Registered person, may raise an SOS for themselves or for someone else (`forSelf`) | Get help fast, share medical details, track the ambulance |
| Guest | Anyone without an account | Raise an SOS with a phone number and location only |
| Family contact | Person saved as an emergency contact, not an account holder | Follow the ambulance on a public link, sent by SMS |
| Driver | Ambulance driver with a registered vehicle | Go online, receive offers, accept, run the trip |
| Hospital admin (`hospital_admin`) | Staff who manage a hospital profile | Keep beds and doctors current, watch incoming patients |
| Dispatcher | Operations staff | Watch all active cases, see nearby ambulances, read analytics |

## 6. Features

Each feature lists its source. "Collection" means an endpoint exists in the Postman file. Acceptance criteria come from the collection's own test scripts unless marked PROPOSED.

### 6.1 Accounts and roles (collection folder 1)

| ID | Feature | Acceptance criteria |
| --- | --- | --- |
| F-01 | Register with name, email, phone, password, role | Returns 201, a token and the user. A repeated email returns 409. See Q-01 about privileged roles. |
| F-02 | Log in | Returns 200 and a token. |
| F-03 | Read current user | Returns the logged-in user including role. |
| F-04 | Every protected route requires a Bearer token | Missing token returns 401. Wrong role returns 403. |

### 6.2 Patient medical ID and contacts (folder 2)

| ID | Feature | Acceptance criteria |
| --- | --- | --- |
| F-05 | Save and read medical ID: blood group, allergies, medical notes, `shareWithCrew` | Saved values are returned. Crew sees the medical ID only when `shareWithCrew` is true. |
| F-06 | Add, list and delete emergency contacts: name, phone, relation | Create returns 201 with an id. List returns `contacts`. Delete returns 204. |
| F-07 | Contacts receive an SMS with the live tracking link when an SOS starts | Stated in the collection description. Delivery depends on D-13. |

### 6.3 Hospitals, doctors and beds (folder 3)

| ID | Feature | Acceptance criteria |
| --- | --- | --- |
| F-08 | Hospital admin creates a hospital: name, address, location, phone, `emergencyAvailable`, departments, bed counts | Returns 201 with an id. |
| F-09 | Search hospitals near a point, with radius and an emergency-only filter | Returns `hospitals` sorted nearest first, each with `distanceKm`. |
| F-10 | View one hospital with departments and beds | Returns the hospital by id. |
| F-11 | Hospital admin adds doctors: name, specialization, experience, qualifications, available days | Returns 201 with an id. |
| F-12 | List doctors, optionally filtered by specialization | Returns `doctors`. |
| F-13 | Hospital staff update ICU and general bed availability | Returns the new `beds`. Ambulance and hospital matching read these values. |

### 6.4 Ambulances and driver app (folder 4)

| ID | Feature | Acceptance criteria |
| --- | --- | --- |
| F-14 | Driver registers an ambulance: registration number, type (BLS, ALS or ICU), operator name, driver phone | Returns 201 with an id. |
| F-15 | Driver sets status to `available`, `offline` or `busy` | Only `available` ambulances are matched. |
| F-16 | Driver sends GPS pings: latitude, longitude, heading, speed | Returns `ok: true`. Sent every 3 to 5 seconds. Broadcast to the emergency channel while on a trip. |
| F-17 | Dispatcher lists available ambulances near a point, filtered by type and radius | Returns `ambulances`, nearest first. |

### 6.5 Emergency flow (folder 5, the core)

| ID | Feature | Acceptance criteria |
| --- | --- | --- |
| F-18 | Patient raises an SOS: location with optional address, `forSelf`, `emergencyType`, `conscious`, `patientCount`, `ambulanceType`, `notes` | Returns 201 with `id`, `status` (`matching` or `assigned`), `trackingToken`, `etaSeconds`, `createdAt`. |
| F-19 | Matching offers the request to the best ambulance first, then the next | Ranking uses road ETA and ambulance type. Each offer expires after 30 seconds (D-12). |
| F-20 | Patient views their emergency | Returns current status, ambulance and ETA. |
| F-21 | Driver sees an inbox of current offers | Returns `offers` that include the new SOS. |
| F-22 | First driver to accept wins | Returns `status: assigned` and a numeric `etaSeconds`. A second accept returns 409. |
| F-23 | Driver advances the trip: `en_route`, `arrived`, `picked_up`, `at_hospital`, `completed` | Each change is pushed live to patient, family link and hospital. |
| F-24 | Driver sees recommended hospitals for the case | Ranked by road ETA, emergency department, matching specialty and free ICU beds. Each item has a numeric `score` and a text `reason`. |
| F-25 | Driver picks the destination when marking `picked_up` | Sets `destinationHospitalId` and sends the pre-alert. |
| F-26 | Hospital sees incoming pre-alerts | Returns `incoming` with `emergencyId`, case type, patient condition and ETA. |
| F-27 | Family tracks without logging in using the tracking token | Returns status, ambulance position and ETA. Never returns medical details. |
| F-28 | Patient sends feedback, rating 1 to 5 with optional comment | Allowed only after completion. Returns 201. |
| F-29 | Patient views history, newest first | Returns `emergencies`. |
| F-30 | Patient cancels before pickup, with a reason | Returns `status: cancelled`. |
| F-31 | Guest raises an SOS with phone, location, emergency type and ambulance type | Returns 201 with `trackingToken`. No login needed. |

### 6.6 AI assistant (folder 6)

| ID | Feature | Acceptance criteria |
| --- | --- | --- |
| F-32 | Triage a described symptom with age and language | Returns `urgency` (`emergency`, `urgent` or `routine`), `sosRecommended`, `suggestedSpecialty`, `disclaimer`. Chest pain with sweating must return `emergency` and `sosRecommended: true`. Fixed rules run before the model. |

### 6.7 Dispatch and analytics (folder 7)

| ID | Feature | Acceptance criteria |
| --- | --- | --- |
| F-33 | Dispatcher lists every emergency that is not completed or cancelled | Returns `emergencies`. |
| F-34 | Summary for a date range | Returns `totalRequests` and `avgAssignSeconds`. |
| F-35 | Response times grouped by hour | Returns `series`. Average time from SOS to arrival. |

### 6.8 Medical reports (new, D-06, PROPOSED detail)

| ID | Feature | Acceptance criteria |
| --- | --- | --- |
| F-36 | Patient uploads, lists, views and deletes medical reports | Files are private. Access is by short-lived signed link. Details in `08-medical-reports.md`. |
| F-37 | Patient chooses what is shared and with whom | Sharing is off by default. Every access is recorded. |
| F-38 | Hospital sees shared reports for an incoming patient | Only for cases routed to that hospital, only for reports the patient shared. |

### 6.9 Platform (folder 0, folder 8)

| ID | Feature | Acceptance criteria |
| --- | --- | --- |
| F-39 | Health check | Returns `status: ok` when the API and database are reachable. |
| F-40 | Every response arrives in under 2 seconds | Collection-level test. |
| F-41 | The API protects itself | Invalid coordinates return 422 and mention location. No token returns 401. Wrong role returns 403. Finished trip accept returns 409. |

## 7. Success measures

The collection defines what the dispatcher dashboard measures, and these are the product's measures too:

- Total requests in a period.
- Average seconds from SOS to ambulance assignment.
- Average time from SOS to arrival, by hour of day.
- Failed matches (named in the collection; see Q-06).

Numeric targets are OPEN. No target may be invented. Agree targets with the owner before the first demo.

## 8. Constraints

- Hosting is Vercel and Supabase only (D-10).
- HTML, CSS and JavaScript are the foundation. Other technology only where really required (D-03).
- Third-party services run on free tiers or trials (D-08, D-09, D-13). Their limits are listed in `16-deployment-and-environments.md`.
- English only (D-05).
- The design rules in `11-design-system.md` are binding (D-16).

## 9. Assumptions

Each assumption is a risk if wrong.

1. Sample coordinates near Secunderabad, Hyderabad are the demo area (the collection says so).
2. The demo has few real users, so free-tier limits are enough.
3. The emergency number shown to users is 112. Verify this and any state-specific ambulance number before launch.

## 10. Risks

| Risk | Effect | Mitigation |
| --- | --- | --- |
| Anyone can register as a dispatcher or hospital admin (Q-01) | Data exposure, fake operations | Resolve Q-01 before auth work |
| False or prank SOS requests from the guest endpoint | Wasted ambulance trips | Rate limits, phone checks, dispatcher visibility. See `09-security.md` |
| A free-tier service stops or changes | Feature loss in demo | Adapters for SMS, LLM and routing; fallbacks; runbook in `17-observability-and-runbook.md` |
| Health text sent to a third-party model | Privacy harm | Send no identifiers. Resolve Q-17 |
| GPS pings every 3 to 5 seconds hit serverless limits | Cost, throttling | Measure early in WP-5; see `02-trd.md` section 9 |
| Hosted routing terms restrict how results are shown | Rework | Verify Mapbox terms before build |

## 11. Release phases

Phases are defined in `15-workflow.md`. In summary: foundation, accounts, patient data, hospitals, ambulances, emergency core, assistant, dispatch, medical reports, hardening and demo.
