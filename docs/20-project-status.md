# Project status, 2026-11-11

What is built, what was checked and against what, what is open, and what to do next. It is an honest account, not a score: no percentage is claimed, because the product has no fixed list of requirements to divide by.

Live site: https://careroute-vert.vercel.app

## What works, and how it was checked

| Area | State | Checked by |
| --- | --- | --- |
| Three views | Patient, driver and admin. One sign-in page with a Patient or Driver switch. An admin can sign in from either side and always lands in the admin portal. Patients and drivers cannot open it. | Unit and browser tests; live on production |
| Sign up and sign in | Email and password only. Google removed from code, database and docs. | Browser tests (sample data); live on production with throwaway accounts |
| Driver approval (D-87) | A new driver registers with a vehicle and waits as pending. The admin sees the request in Driver requests, approves or rejects it. Only approved drivers can go online or receive requests. A rejected or withdrawn driver's ambulance goes offline. Each decision is in the audit log. | Unit tests, browser test, same flow through the real server against careroute-dev; live on production (pending driver refused with `driver_not_approved`, approved driver then received a request) |
| Password reset (D-88) | No email service yet. A person asks on the sign-in page, the admin sees the request, issues a one-time link valid for 2 hours and hands it over. Using it sets the password and signs out every session. Only a hash of the link is stored. | Unit tests; live on production (link worked once, second use refused, old password refused) |
| Admin account (D-89, D-90) | `admin1234@gmail.com` is the admin in production and careroute-dev, flagged so the portal shows a banner until its password is changed. `lakshmansirvi1812@gmail.com` stays the owner's patient account. | Signed in live as the admin (role admin) |
| Two accounts at once | A patient and two drivers were signed in at the same time, and one driver signed in on a second device without ending the first. | Live on production |
| Driver | Goes online with live location or a chosen area, is alerted, accepts or declines, drives the trip step by step, can delete the account. | Unit tests; two-browser test on sample data; same test through the real server against careroute-dev |
| Ambulance request | The patient's page asks for location by itself and will not send without a place. The request reaches the nearest online approved driver only. | Unit and browser tests; live on production |
| Privacy of a request | Before accepting, a driver sees the kind of emergency, people, consciousness and distance. The place, address, notes and any shared medical ID come after accepting. | Unit tests; security review |
| Current location | Live location, area choice, real map tiles and nearest places. | Live on production earlier today |
| Medicine prices | Official Jan Aushadhi list loaded into production today (for example Indomethacin now 13.41). 2,100 active medicines, 1,608 active hospitals. | Compared with the official list; loader run against production |
| Links | 63 listing websites whose domain no longer exists were cleared in production. Other failures in the sample were mostly bot blocks or timeouts and were left. | `check-websites.js` against production |
| Database | Migrations applied to production and careroute-dev: offer grant, Google column removed, approval and reset tables, 7 foreign key indexes. Simulated crews and test accounts removed from production. Row Level Security is on for every table, with no policy for `anon` or `authenticated` by design (D-49). | Supabase advisors; table counts after cleanup |
| Final audit (2026-11-12) | Every one of the 110 routes: 401 without a token and 403 for each wrong role (live, patient and driver tokens; local against careroute-dev, all three roles). About 2,000 hostile requests (bad ids, NUL bytes, odd query values, odd bodies) against every route locally: no 5xx after the fixes below. Live: 1,608 hospitals, 2,100 medicines, 1,558 doctors, 242 pharmacies and 145 diagnostic centres list and open with no errors; no listing has a bad location or website. Live patient run in a real browser (profile, medical ID, contacts, reminders, appointments, search, nearby, prices, SOS, deletion), new driver run (pending, refused, deleted), assistant run (consent, real model reply in about 1 s, emergency rule). Public Supabase key is refused on every table and bucket. | Scripts against the live site and a real browser; see the changelog |
| Tests | 497 unit and API tests pass. 49 browser tests pass on a sample-data server (no retries), run again after the final code change. | Run on 2026-11-12 |

Production users now: 1 admin and 1 patient (the owner's own account).

## Not done, and why

| Item | Why | What to do |
| --- | --- | --- |
| Alert when the driver page is closed | There is no push service. Alerts work while the driver page is open, including in a background tab | Web Push or SMS to the driver (SMS needs a paid or verified Twilio setup) |
| Password reset by email | No email service is chosen. The admin hands out reset links | Pick a free-tier email service, then send the link automatically |
| The owner's patient account was made earlier through Google | It also has a password and holds patient profile and medical data. It was kept | None |

## Open decisions for the owner

1. Admin accounts are created only with the script or SQL. There is no screen to add a second admin.
2. Email service for resets and driver notices (see above).
3. Driver "reject" of an offered trip (P-20) exists in the code and is still marked proposed.
4. The landing page was out of scope for this round.

## Found and fixed in the final audit

- Malformed JSON returned 500 on Vercel instead of 400 (the platform parser throws before our code). Fixed in `server/http.js`, test `tests/http-body.test.js`.
- A NUL byte in search text (for example `?area=%00`) returned 500 on five list routes. Every request input is now checked in `parse`, so it answers 422. Tests in `tests/http-body.test.js` and `tests/route-inputs.test.js`.
- Driver page: after choosing a place, a late "location blocked" callback from the browser could replace the confirmation and stop the place's keep-alive pings, so the driver could drop out of matching. Found while testing the live driver trip with the owner signed in; fixed in `public/js/pages/driver.js`. The existing browser tests pass; no new test, because it needs an unlucky browser timing.
- Four hospital entries named with one generic word ("hospital", "ground", "dental", "hs") were hidden in production, and the loader now skips such names.

## Found and not changed

- Vercel showed its Security Checkpoint (403 for scripts, a short checking page for browsers) for about 40 minutes after a burst of test traffic from one computer, including to another address. It cleared by itself. Whether that was automatic protection or a setting could not be read with the access this session has, so the owner should look at the project's Firewall page (runbook R-13). Ordinary browsers pass the checkpoint.
- Signed-out visitors see a red 401 in the browser console from the session check on every page. It is harmless and expected, and it was left alone because removing it touches every page's sign-in handling.
- Signup is limited to 10 accounts per hour per address. Many people behind one shared mobile address could hit it.
- One 20 second client timeout happened once in about 600 live requests. Server logs showed no slow request and no 5xx, so the cause is unconfirmed and probably the network on the test computer.
- `tests/e2e/admin-portal.spec.js` "finds available crews near an area" expects crews, so it fails against a real database with none online. It passes on sample data. It was not changed.
- Admin screens: first checked only by browser tests and a local server, then driven live in a real browser with the owner signed in (overview, driver requests, people, listings with hide and show, data quality, reviews, audit log, live emergencies, phone width). Creating or editing a listing and disabling an account were not done live, to keep production data clean.
- Driver trip: driven live in a real browser with the owner signed in as an approved driver and a throwaway patient: place choice, offer with alert, accept, five trip steps with the patient seeing each state, complete, back to waiting.

## Known gaps in the code

- A driver deleting an account in the same instant as another accept could leave a trip without an ambulance (rare race; the guard checks first but does not lock).
- No speed or jump check on driver location pings (a rate limit exists).
- Route times use straight-line estimates unless a Mapbox token is set.
- One browser test (guest SOS in `tests/e2e/ambulance.spec.js`) failed once in one full run and passed in the next two full runs and alone. Its cause was not captured, and the retry then hit the guest request limit, which hid the first failure. Treat it as intermittent until reproduced.
- Sample hospitals, prices and crews exist only in the in-memory store used for tests and local work without a database; production never uses them.

## Suggested plan

1. Owner changes the admin password and decides on the older production account.
2. Look at the Vercel Firewall page (runbook R-13) and choose a free email service and send reset links and driver approval notices by email.
3. Add a way to be alerted with the page closed.
4. Reproduce and fix the intermittent guest SOS browser test.
5. Re-check listing websites monthly with `check-websites.js`, and prices with `collect-medicines.js` then the loader.
