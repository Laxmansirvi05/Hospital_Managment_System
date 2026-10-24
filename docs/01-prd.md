# Product requirements: CareRoute

Status of this document: draft for owner approval. Anything not traceable to the owner's decisions (`00-decisions.md`) or the Postman collection is marked PROPOSED or OPEN. The product vision of 2026-10-24 is recorded as D-26 to D-34.

## 1. Purpose

CareRoute is a Hyderabad-first healthcare discovery and assistance platform (D-26, D-27). It brings together, in one place:

1. **Healthcare discovery.** Find hospitals, doctors, medicines and their listed prices, pharmacies and diagnostic centres.
2. **AI healthcare assistant.** Understand a medical report in plain language, and find relevant healthcare resources by describing a need in ordinary words.
3. **Emergency ambulance system.** Request an ambulance, let registered drivers receive and run the request, and let the patient and family follow it live.

For discovery, CareRoute shows information and sends the user to the official provider to take the next step (D-28). The ambulance system is the one part that runs a real workflow inside CareRoute.

## 2. Problem

People in Hyderabad search across many websites and apps to find a hospital, a doctor, the price of a medicine, a nearby pharmacy or a diagnostic centre. Medical reports are hard to read without help. In an emergency, people lose time reaching an ambulance and knowing where it is, and families wait without information.

## 3. Goals

1. A user can search hospitals, doctors, medicines, pharmacies and diagnostic centres in Hyderabad from one search interface, with filters that fit each type.
2. Each result shows publicly available details and a direct way to reach the provider: phone, email, official website or the platform's product page.
3. A user can compare a medicine's listed price across online platforms and go to the platform to buy it.
4. A patient can upload a medical report and get a plain-language explanation of its terms and values.
5. A user can describe a health need in natural language and be shown relevant specialities and facilities.
6. A patient or a bystander can raise an SOS in very few steps, with or without an account.
7. The best available ambulance is offered the job automatically, ranked by road ETA and vehicle type, and the driver can accept or reject it.
8. The patient and family see live status and ETA.
9. The platform admin can manage users and the healthcare listing data.

## 4. Non-goals

These are product boundaries (D-28, D-29, D-33) and earlier locked limits.

- Booking or managing hospital appointments.
- Live doctor availability or appointment slots.
- Hospital bed availability or management, and any hospital-side portal or dashboard.
- Selling medicines, taking orders or payments, or managing pharmacy inventory.
- Booking diagnostic tests or collecting diagnostic reports.
- Prescriptions, recommending a medicine as treatment, or a definitive diagnosis from the assistant.
- Native mobile apps (D-02).
- Languages other than English (D-05).
- WhatsApp or any channel other than SMS (D-17).
- Cities other than Hyderabad at launch (D-27).
- Manual assignment of an ambulance by a person. There is no endpoint for it (see Q-07).

## 5. Users

| Role | Who | Main job |
| --- | --- | --- |
| Patient (`patient`) | Registered person. May raise an SOS for themselves or someone else (`forSelf`). | Find healthcare resources, understand reports, get an ambulance, share medical details with the crew |
| Guest | Anyone without an account | Raise an SOS with a phone number and location only (D-31). Whether a guest can use discovery is OPEN (Q-27). |
| Family contact | Person saved as an emergency contact, not an account holder | Follow the ambulance on a public link sent by SMS (D-31) |
| Driver (`driver`) | Ambulance driver with a registered vehicle | Set availability, receive offers, accept or reject, run the trip |
| Platform admin (`admin`) | CareRoute operations staff | Manage users and healthcare listing data. Whether the admin also sees live emergencies and analytics is PROPOSED (P-18). |

There is no hospital admin and no dispatcher role (D-29). `driver` and `admin` accounts are privileged and are created as described in D-21.

## 6. Features

Each feature lists its source. "Collection" means the request is in the Postman file. Feature ids from the first version are kept so references stay stable. Removed features are listed in section 6.10.

### 6.1 Accounts and roles (collection folder 1)

| ID | Feature | Acceptance criteria |
| --- | --- | --- |
| F-01 | Register with name, email, phone, password, role | Returns 201, a token and the user. A repeated email returns 409. Only `patient` self-registers in production (D-21). |
| F-02 | Log in | Returns 200 and a token. |
| F-03 | Read current user | Returns the logged-in user including role. |
| F-04 | Every protected route requires a valid token | Missing token returns 401. Wrong role returns 403. |

### 6.2 Healthcare discovery (D-26 to D-28)

Search is one interface with a type selector: hospitals, doctors, medicines, pharmacies, diagnostic centres. Every listing shows where its data came from and when it was last checked (P-24). Listing and medicine data are taken from online platforms such as Apollo, MedPlus, Tata 1mg and others (D-35). How it is collected is OPEN (Q-28). Ratings and reviews are OPEN (Q-24).

| ID | Feature | Acceptance criteria |
| --- | --- | --- |
| F-09 | Search hospitals near a point, with radius and an emergency-only filter | Collection. Returns `hospitals` sorted nearest first, each with `distanceKm`. |
| F-10 | View one hospital | Collection. Returns the hospital by id with departments and public details. |
| F-12 | List a hospital's doctors, optionally filtered by specialization | Collection. Returns `doctors`. |
| F-42 | Search hospitals by name, area, speciality or department, and rating | PROPOSED endpoint (P-19). Each result shows name, description, address, map location, phone, email if public, official website, specialities and departments, rating if available (Q-24). |
| F-43 | Search doctors without choosing a hospital first, by name, specialization and area | PROPOSED endpoint (P-19). Profile shows name, specialization, qualifications, experience, hospital or clinic, consultation timings only if officially published, rating if available, contact, official profile link. No live availability or slots (D-28). |
| F-44 | Search a medicine by name and compare listed prices across platforms such as Tata 1mg, Apollo Pharmacy and MedPlus | PROPOSED endpoint (P-19). Each listing shows medicine name, brand or product, platform, listed price, rating if available, a direct product link and when the price was checked. Data from the platforms themselves (D-35), collection method OPEN (Q-28). |
| F-45 | Find pharmacies and medical stores in an area | PROPOSED endpoint (P-19). Shows name, address, map location and directions link, phone, email and website if public, rating if available. |
| F-46 | Find diagnostic centres, pathology labs and testing centres in an area | PROPOSED endpoint (P-19). Shows name, tests and services if publicly listed, address, directions link, phone, email and website if public, rating if available. |
| F-47 | Contact or visit the provider | Phone, email and website links open the provider directly. CareRoute states that the user is leaving CareRoute for an outside site. |

### 6.3 AI healthcare assistant (D-33, collection folder 6)

| ID | Feature | Acceptance criteria |
| --- | --- | --- |
| F-32 | Triage a described symptom with age and language | Collection. Returns `urgency` (`emergency`, `urgent` or `routine`), `sosRecommended`, `suggestedSpecialty`, `disclaimer`. Chest pain with sweating must return `emergency` and `sosRecommended: true`. Fixed rules run before the model. |
| F-48 | Explain an uploaded medical report in plain language | PROPOSED design (P-21). Explains terms and values and says which values the report itself marks as outside its reference range. Always shows the disclaimer. Never diagnoses or prescribes. Blocked by Q-25. |
| F-49 | Find healthcare resources from a description in natural language | PROPOSED design (P-23). Returns a suggested speciality and matching doctors, hospitals, pharmacies, diagnostic centres or medicines from CareRoute's data, with the disclaimer. External sources wait for Q-26. |
| F-50 | Safety limits on every assistant answer | The assistant never prescribes, never recommends a medicine as treatment, never claims a definitive diagnosis, never presents itself as a replacement for a qualified professional, and never promises an outcome (D-33). Tests prove each limit. |

### 6.4 Patient medical ID and contacts (collection folder 2)

| ID | Feature | Acceptance criteria |
| --- | --- | --- |
| F-05 | Save and read medical ID: blood group, allergies, medical notes, `shareWithCrew` | Saved values are returned. Crew sees the medical ID only when `shareWithCrew` is true. |
| F-06 | Add, list and delete emergency contacts: name, phone, relation | Create returns 201 with an id. List returns `contacts`. Delete returns 204. |
| F-07 | Contacts receive an SMS with the live tracking link when an SOS starts | Kept (D-31). Delivery depends on D-13. |

### 6.5 Medical reports (D-06)

| ID | Feature | Acceptance criteria |
| --- | --- | --- |
| F-36 | Patient uploads, lists, views and deletes medical reports | Files are private. Access is by short-lived signed link. Details in `08-medical-reports.md`. |
| F-37 | Patient controls any sharing | Sharing is off by default. Every access by someone else is recorded. Whether the crew can see reports is OPEN (Q-11). |

### 6.6 Ambulances and driver app (collection folder 4)

| ID | Feature | Acceptance criteria |
| --- | --- | --- |
| F-14 | Driver registers an ambulance: registration number, type (BLS, ALS or ICU), operator name, driver phone | Returns 201 with an id. |
| F-15 | Driver sets status to `available`, `offline` or `busy` | Only `available` ambulances are matched. |
| F-16 | Driver sends GPS pings: latitude, longitude, heading, speed | Returns `ok: true`. Sent every 3 to 5 seconds. Broadcast to the emergency channel while on a trip. |

### 6.7 Emergency flow (collection folder 5, the core)

| ID | Feature | Acceptance criteria |
| --- | --- | --- |
| F-18 | Patient raises an SOS: location with optional address, `forSelf`, `emergencyType`, `conscious`, `patientCount`, `ambulanceType`, `notes` | Returns 201 with `id`, `status` (`matching` or `assigned`), `trackingToken`, `etaSeconds`, `createdAt`. |
| F-19 | Matching offers the request to the best ambulance first, then the next | Ranking uses road ETA and ambulance type. Each offer expires after 30 seconds (D-12). |
| F-20 | Patient views their emergency | Returns current status, ambulance and ETA. |
| F-21 | Driver sees an inbox of current offers | Returns `offers` that include the new SOS. |
| F-22 | First driver to accept wins | Returns `status: assigned` and a numeric `etaSeconds`. A second accept returns 409. |
| F-51 | Driver rejects an offer | D-32. The next ranked offer opens at once. Endpoint PROPOSED (P-20). |
| F-23 | Driver advances the trip: `en_route`, `arrived`, `picked_up`, `at_hospital`, `completed` | Each change is pushed live to the patient and the family link. `picked_up` takes no destination (D-30). |
| F-27 | Family tracks without logging in using the tracking token | Returns status, ambulance position and ETA. Never returns medical details. |
| F-28 | Patient sends feedback, rating 1 to 5 with optional comment | Allowed only after completion. Returns 201. |
| F-29 | Patient views history, newest first | Returns `emergencies`. |
| F-30 | Patient cancels before pickup, with a reason | Returns `status: cancelled`. |
| F-31 | Guest raises an SOS with phone, location, emergency type and ambulance type | Returns 201 with `trackingToken`. No login needed. Kept (D-31). |

Working with real ambulance operators is a goal in the vision. How it fits the demo scope is OPEN (Q-21).

### 6.8 Platform administration (D-29)

| ID | Feature | Acceptance criteria |
| --- | --- | --- |
| F-52 | Admin manages user accounts | PROPOSED (P-22). List and disable accounts. Creating driver and admin accounts follows D-21. Admin screens never show medical ID, reports or emergency notes. |
| F-53 | Admin manages healthcare listings | PROPOSED (P-22). Create, edit and hide hospitals, doctors, pharmacies, diagnostic centres and medicine listings, each with source and checked date (P-24). |
| F-33 | Admin lists every emergency that is not completed or cancelled | Moved from the dispatcher. PROPOSED (P-18). |
| F-34 | Summary for a date range: `totalRequests` and `avgAssignSeconds` | Moved from the dispatcher. PROPOSED (P-18). |
| F-35 | Response times grouped by hour | Moved from the dispatcher. PROPOSED (P-18). |
| F-17 | Available ambulances near a point, filtered by type and radius | Moved from the dispatcher. PROPOSED (P-18). |

### 6.9 Platform (collection folders 0 and 7)

| ID | Feature | Acceptance criteria |
| --- | --- | --- |
| F-39 | Health check | Returns `status: ok` when the API and database are reachable. |
| F-40 | Every response arrives in under 2 seconds | Collection-level test. |
| F-41 | The API protects itself | Invalid coordinates return 422 and mention location. No token returns 401. Wrong role returns 403. Accepting a finished trip returns 409. |

### 6.10 Removed features

| ID | Feature | Removed by |
| --- | --- | --- |
| F-08 | Hospital admin creates a hospital | D-29. Hospitals are listing data managed by the admin (F-53). |
| F-11 | Hospital admin adds doctors | D-29. Doctors are listing data (F-53). |
| F-13 | Hospital staff update bed availability | D-28, D-30 |
| F-24 | Driver sees recommended hospitals | D-30 |
| F-25 | Driver picks the destination hospital at pickup | D-30 |
| F-26 | Hospital sees incoming pre-alerts | D-29, D-30 |
| F-38 | Hospital sees shared reports for an incoming patient | D-29 |

## 7. Success measures

Measures that the product can count once built:

- Ambulance: total requests in a period, average seconds from SOS to assignment, average time from SOS to arrival by hour of day, failed matches (see Q-06).
- Discovery: searches by type, searches with no result, clicks out to providers (PROPOSED, needs a privacy check before any tracking is added).

Numeric targets are OPEN. No target may be invented. Agree targets with the owner before the first demo.

## 8. Constraints

- Hosting is Vercel and Supabase only (D-10).
- HTML, CSS and JavaScript are the foundation. UI frameworks and TypeScript are allowed when necessary. All other technology only where really required. Each adoption needs the owner's approval (D-03, `02-trd.md` section 1.2).
- Third-party services run on free tiers or trials (D-08, D-09, D-13). Their limits are listed in `16-deployment-and-environments.md`.
- English only (D-05). Hyderabad only (D-27).
- The design rules in `11-design-system.md` are binding (D-16).

## 9. Assumptions

Each assumption is a risk if wrong.

1. Sample coordinates near Secunderabad, Hyderabad are the demo area (the collection says so).
2. The demo has few real users, so free-tier limits are enough.
3. The emergency number shown to users is 112. Verify this and any state-specific ambulance number before launch.

## 10. Risks

| Risk | Effect | Mitigation |
| --- | --- | --- |
| Listing data is wrong or out of date: a wrong phone number, a closed pharmacy, an old price | A user loses time, possibly in a health need | Source and checked date on every listing (P-24), admin edits, a way to report wrong data (PROPOSED) |
| Collecting listing or price data from Apollo, MedPlus, Tata 1mg and others breaks their terms of use | Legal risk, blocked access, data that stops updating | Read and record each platform's terms and robots.txt before collecting (Q-28). Prefer an official API, feed or partnership where one exists. |
| Linking straight to a platform's product page breaks its terms (1mg forbids deep linking, see `19-setup-checklist.md`) | F-44 product links may need a different form or the platform's permission | Part of Q-28 |
| A platform changes its pages | Collected data stops updating or comes in wrong | Checked date on every listing (P-24), a failure alert per platform, listings hidden when too old (PROPOSED) |
| Showing reviews from another site | Copyright or terms breach | Resolve Q-24 |
| Report content sent to a third-party model | Privacy harm to the most sensitive data in the product | Resolve Q-25. Demo uses synthetic reports only. |
| The assistant reads as medical advice | Harm, liability | D-33 limits, rule layer, server-side disclaimer, tests for each limit |
| Doctor profiles are personal data of real people | Privacy and legal duties | Resolve Q-22, publish only what the source platform shows publicly |
| False or prank SOS requests from the guest endpoint | Wasted ambulance trips | Rate limits, phone checks. See `09-security.md` |
| Real ambulance use without partnerships and legal review | Safety harm | Resolve Q-21 before any real request is routed |
| A free-tier service stops or changes | Feature loss in demo | Adapters for SMS, LLM and routing, fallbacks, runbook in `17-observability-and-runbook.md` |
| GPS pings every 3 to 5 seconds hit serverless limits | Cost, throttling | Measure early in WP-5. See `02-trd.md` section 10 |
| Hosted routing terms restrict how results are shown | Rework | Verify Mapbox terms before build |

## 11. Release phases

Phases are defined in `15-workflow.md`. In summary: foundation, accounts, patient data, hospital and doctor discovery, ambulances, emergency core, assistant, admin, hardening, medical reports, pharmacy, diagnostic and medicine discovery, and demo.
