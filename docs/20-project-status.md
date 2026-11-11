# Project status, 2026-11-11

What is built, what was checked and against what, what is open, and what to do next. It is an honest account, not a score: no percentage is claimed, because the product has no fixed list of requirements to divide by.

Live site: https://careroute-vert.vercel.app

## What works, and how it was checked

| Area | State | Checked by |
| --- | --- | --- |
| Sign up and sign in | Email and password only. Patient or Driver switch on the same page. Google removed. | Browser tests (sample data); live on production with throwaway accounts |
| Two accounts at once | A patient and two drivers were signed in at the same time, and one driver signed in on a second device without ending the first. | Live on production |
| Driver | Registers with a vehicle, goes online with live location or a chosen area, is alerted, accepts or declines, drives the trip step by step, can delete the account. | Unit tests; two-browser test on sample data; the same test through the real server against careroute-dev |
| Ambulance request | The patient's page asks for location by itself and will not send without a place. The request reaches the nearest online driver only; other drivers see nothing and cannot accept it. | Unit and browser tests; live on production (request created, offered to the nearest driver, not to the other) |
| Privacy of a request | Before accepting, a driver sees the kind of emergency, people, consciousness and distance. The place, address, notes and any shared medical ID come after accepting. Guests are never shown to anyone beyond the tracking link. | Unit tests; security review |
| Current location | Live location, area choice, real map tiles and nearest places. | Live on production: "near KPHB Colony", 6 of 6 tiles loaded, nearest hospital 0.1 km |
| Medicine prices | Official Jan Aushadhi list. 88 of 2,096 prices had changed since the last load. | Compared with the live official list; careroute-dev refreshed; production not yet |
| Links | All 37 internal link targets exist. Of 293 sampled external websites, 94 failed: 63 domains no longer exist, the rest were mostly refused by bot blocks or timeouts. | Link check against careroute-dev data |
| Admin portal | Built (overview, people, listings, reviews, audit log, emergency operations, data quality). | Unit and browser tests; store methods run against careroute-dev earlier |
| Tests | 470 unit and API, 47 browser. | Run on 2026-11-11 |

## Not done, and why

| Item | Why | What to do |
| --- | --- | --- |
| Production medicine price refresh and dead-website cleanup | Writing to the production database was blocked in this session | `node --env-file=.env.local scripts/load-listings.js --prod`, then `node --env-file=.env.local scripts/check-websites.js --apply --prod` |
| Migrations `20261106000200_open_next_offer_grant.sql` and `20261111000100_remove_google_sign_in.sql` | Not applied to production (no database access from this session). SOS works without the first; the second only drops an unused column | Apply both in the Supabase SQL editor when convenient |
| 12 simulated crews still in the production database | Cannot delete without database access. The code never offers or lists them | `delete from public.ambulances where is_demo;` |
| Admin account for production | Creating accounts needs the owner's password | `node --env-file=.env.local scripts/create-privileged-account.js --role admin --name "Name" --email you@example.com` with the production `DATABASE_URL` |
| Accounts made earlier with Google | They have no password and cannot sign in now | `scripts/set-account-password.js --email ...` for each |
| Alert when the driver page is closed | There is no push service. Alerts work while the driver page is open, including in a background tab | Web Push or SMS to the driver (SMS needs a paid or verified Twilio setup) |

## Open decisions for the owner

1. Driver accounts are not verified. Anyone can register as a driver. Offers are coarse until accepted, which limits what a fake driver learns, but a fake driver could still accept a request and see its place. Option: an admin approves each new driver before they can go online.
2. Driver "reject" (P-20) exists in the code and is still marked proposed.
3. Password reset by email is not built; the recovery script above is the only way.
4. The landing page was out of scope for this round.

## Known gaps in the code

- A driver deleting an account in the same instant as another accept could leave a trip without an ambulance (rare race; the guard checks first but does not lock).
- No speed or jump check on driver location pings (a rate limit exists).
- Route times use straight-line estimates unless a Mapbox token is set.
- Sample hospitals, prices and crews exist only in the in-memory store used for tests and local work without a database; production never uses them.

## Suggested plan

1. Run the three production commands above and create the admin account.
2. Decide on driver approval (open decision 1) and build it if wanted.
3. Add a way to be alerted with the page closed.
4. Password reset by email.
5. Re-check listing websites monthly with `check-websites.js`, and prices with `collect-medicines.js` then the loader.
