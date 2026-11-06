# Ambulance system: demo build plan

Date: 2026-11-04. Status: approved to build as a synthetic demo (D-72 to D-79). Decisions win over this page. States and rules: `06-emergency-lifecycle.md`. Tables and functions: `04-data-model.md` and `supabase/migrations/20261104000100_emergency.sql`.

## 1. What "complete" means for the demo

1. A patient or a guest raises an SOS from the SOS screen. The screen says "Call 112" first and "Demo: no real ambulance is sent" everywhere in this flow (D-72).
2. The server ranks up to 5 demo or real-driver ambulances, opens one 30 second offer at a time (D-74).
3. A demo crew accepts after 5 to 20 seconds, sometimes declines (D-78). A real `driver` account can do the same through the driver screen.
4. The ambulance moves toward the patient. The patient sees status, ETA and a moving marker, and can cancel before pickup.
5. Saved contacts get one SMS with a tracking link (Twilio trial, verified numbers only, D-79). A public tracking page shows status, position and ETA only (D-75).
6. The trip runs through `en_route`, `arrived`, `picked_up`, `at_hospital`, `completed`. The patient can leave feedback after `completed`.
7. An admin sees active emergencies, nearby ambulances, a timeline per emergency and basic analytics (P-18).
8. If nobody accepts, the state is `no_match`, the patient sees "Call 112" and may try again.

Not in scope: real operators, payments, hospital pre-alerts or destination hospitals (D-30), manual assignment, Supabase Realtime (D-77).

## 2. Routes to build (all under `/api/v1`)

Roles: P patient, G guest (no account), D driver, A admin, T tracking token. Every route is registered with its roles in `server/router.js`. Errors use the existing shape; input errors are 422 `invalid_input`; a forbidden move is 403, an impossible move is 409.

| Method and path | Who | Purpose |
| --- | --- | --- |
| `POST /emergencies` | P or G | Create an SOS. Body: `emergencyType`, `forSelf`, `conscious`, `patientCount`, `ambulanceType`, `notes`, `location {lat,lng}`, `address`, `guestPhone` (guest only). Returns the emergency and the `trackingToken` once. Rate limit: 3 per hour per phone and per network address (D-76). |
| `GET /emergencies/active` | P | The patient's active emergency or null. |
| `GET /emergencies` | P | History, newest first, paged. |
| `GET /emergencies/:id` | P owner | Status, ambulance (type, registration, first name, phone only after `assigned`), ETA, positions, timeline. |
| `POST /emergencies/:id/cancel` | P owner | Calls `cancel_emergency`. Only before `picked_up`. |
| `POST /emergencies/:id/feedback` | P owner | Rating 1 to 5, comment. Only when `completed`. |
| `GET /track/:token` | T | Public: `status`, `ambulance {lat,lng,heading}`, `etaSeconds`, `etaIsEstimate`, `demo: true`. No names, no phones, no medical data. Expires per D-75. |
| `POST /track/:token/cancel` | T | Guest cancel. |
| `GET /driver/me` | D | The driver's ambulance. |
| `PUT /driver/me/status` | D | `available` or `offline`. |
| `PUT /driver/me/location` | D | Ping: `lat`, `lng`, `heading`, `speed`. |
| `GET /driver/offers` | D | The open offer for this ambulance, with pickup, type, `conscious`, `patientCount`, `notes`, seconds left. Medical ID only if `shareWithCrew`. |
| `POST /driver/offers/:emergencyId/accept` | D | `accept_emergency`. |
| `POST /driver/offers/:emergencyId/reject` | D | `decline_offer` (D-32). |
| `GET /driver/trips/active` | D | Current trip. |
| `POST /driver/trips/:emergencyId/status` | D | Body `{status}`, forward moves only via `advance_emergency`. `picked_up` takes no destination (D-30). |
| `POST /driver/me/release` | D | `release_ambulance`, back to available after a trip. |
| `GET /admin/emergencies` | A | Active and recent, filter by status. |
| `GET /admin/emergencies/:id` | A | Detail with the `emergency_events` timeline. |
| `GET /admin/ambulances` | A | All ambulances with status and position. |
| `GET /admin/analytics` | A | Total requests, average seconds to assign, average seconds to arrive by hour (state the time zone on the chart: Asia/Kolkata), `no_match` count. |

Matching runs inside `POST /emergencies`: `nearby_ambulances` (10 km, type rule), ETA (Mapbox if `MAPBOX_TOKEN` is set, else the straight-line estimate of D-74), rank, `create_offers`. A SMS to each saved contact is queued after the response; its result is an `emergency_events` row (`sms_sent` or `sms_failed`).

## 3. Server modules

| Module | Job |
| --- | --- |
| `server/emergency/service.js` | Create, match, cancel, advance. Calls the adapter functions only; no state rules outside the database functions and their memory twins. |
| `server/emergency/demo-crew.js` | The simulator (D-78). Pure functions of (emergency, offers, ambulance, now) so it is testable with a fake clock. Runs when an emergency is read by the patient, the track page or the driver screen. Never acts on an ambulance without `is_demo`. |
| `server/integrations/mapbox.js` | Matrix ETA with a timeout and the straight-line fallback. Fake for tests. Key is server only. |
| `server/integrations/sms.js` | Twilio adapter plus a fake. Message names no health detail. |
| `server/db/memory.js`, `server/db/postgres.js` | Same methods on both: ambulances, emergencies, offers, events, feedback. The memory twins implement the same rules as the SQL functions, including the 30 second expiry and the one-open-offer rule. |

## 4. Screens (design system rules and D-16 apply)

| Screen | Path | Notes |
| --- | --- | --- |
| SOS | existing `/sos/` | "Call 112" first, large. Then the demo form. One tap sends; a 5 second "Cancel request" banner (D-76). Guest needs a phone number. |
| Emergency status | `/emergency/` | Stepper, ETA, map with the ambulance, cancel, copy tracking link, feedback after completion. Polls every 3 seconds (D-77). |
| Public tracking | `/track/` | Reads the token from the page address. Status, ETA, map. |
| Driver | `/driver/` | Available toggle, offer card with a visible 30 second countdown, accept and reject, trip steps, location ping. |
| Admin | `/admin/` | Active list, ambulances map, emergency timeline, analytics. |

Every one of these shows the demo notice. Touch targets are at least 44 px, status changes are announced to screen readers, no cursor effects, no gradients, no banned patterns.

## 5. Order of work and owners

| Step | Work | Owner |
| --- | --- | --- |
| 1 | Database: tables, functions, cron, demo crews. Done on dev, 12 SQL scenarios pass. | Claude |
| 2 | Server: memory adapter, service, simulator, routes, Mapbox and SMS adapters with fakes, tests. | Codex |
| 3 | Postgres adapter SQL. Codex lists every statement in the hand-off; Claude runs them against dev inside rolled-back transactions and reports differences. | Codex writes, Claude verifies |
| 4 | Patient screens: SOS, status, tracking. | Codex |
| 5 | Driver and admin screens. | Codex |
| 6 | Browser tests in sample mode: the full flow with a fake clock. | Codex |
| 7 | Apply the migrations to production. Needs the owner's written yes. | Claude |
| 8 | Owner checks: Twilio verified numbers, optional Mapbox key, privacy review of the demo data, then push. | Owner |

## 6. Limits to keep in mind

- Twilio trial sends only to verified numbers, so only a few test contacts get an SMS.
- Vercel Hobby functions are short; this is why the design polls and keeps the simulator stateless.
- pg_cron runs the offer expiry every 10 seconds on dev (verified). Re-verify on production before relying on it.
- Without a Mapbox key every ETA is labelled an estimate.
