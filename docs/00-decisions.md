# Decision log

This file is the single source of truth for what is decided, what is proposed, and what is still open. Every other document defers to it. If a document contradicts this file, this file wins and the document is wrong.

## Status labels

| Label | Meaning |
| --- | --- |
| LOCKED | Decided by the project owner in chat. Do not change without the owner's explicit approval. |
| COLLECTION | Taken directly from `postman/ambulance-platform.postman_collection.json`. The collection is the API contract. |
| PROPOSED | Written by Claude to fill a gap. Not approved. Clearly marked wherever it appears. Needs a yes or a change from the owner. |
| OPEN | Unknown. Nobody has decided. Must be answered before the work that depends on it starts. |

Rule for agents and contributors: never turn an OPEN item into a PROPOSED or LOCKED one silently. Ask.

## 1. Locked decisions

| ID | Decision | Notes |
| --- | --- | --- |
| D-01 | Product name is **CareRoute**. | Trademark and domain availability have not been checked. Verify before any public launch. |
| D-02 | Web only, responsive. One web app, no native mobile apps. | Patient and driver views are mobile-first. The platform admin views are desktop dashboards (roles changed by D-29). |
| D-03 | HTML, CSS and JavaScript are the foundation, for the frontend and for the Node.js API. UI frameworks and TypeScript are allowed when necessary. Any other technology is used only where it is really required. Each adoption follows the rule in `02-trd.md` section 1.2: a written need and the owner's approval. | Changed on 2026-10-17 (TypeScript and Next.js removed) and again on 2026-10-24 (UI frameworks and TypeScript allowed when necessary). No framework or TypeScript has been chosen yet. |
| D-04 | Scope is a demo that is built to production standard. | Real hospital integrations and uptime commitments are out of scope. Security, privacy, accessibility and code quality are not reduced for the demo. The product vision of 2026-10-24 names real ambulance operators as a goal. How that fits this decision is OPEN (Q-21). |
| D-05 | English only for now. | The triage `language` field stays in the API but only `en` is built. |
| D-06 | Medical reports are a new feature. | Patients upload lab reports, prescriptions and scans. Detail is in `08-medical-reports.md`. Plain-language explanation of a report by the assistant was added by D-33. Sharing with hospitals was removed by D-29. |
| D-07 | Triage language model order: Gemini API first, Groq second, OpenRouter third. | A fixed red-flag rule layer runs before any model. See `07-ai-triage.md`. Using the same chain for report explanation and the discovery assistant is PROPOSED (P-21, P-23). |
| D-08 | Map tiles come from MapTiler's free tier, rendered with MapLibre. | Checked 2026-10-17: the free plan is non-commercial and research only, 100,000 requests a month. See Q-20. |
| D-09 | Routing, road ETA and distance matrix come from Mapbox, called from the server only. | Replaces the earlier OSRM choice because OSRM needs an always-on server. Mapbox terms about using its routing results with a non-Mapbox map have not been verified. Check before build. |
| D-10 | Hosting is Vercel plus Supabase only. No separate server. | Supabase provides PostgreSQL with PostGIS and file Storage. |
| D-11 | Realtime uses Supabase Realtime, not Socket.IO. | Consequence of D-10. Vercel is not a reliable host for long-lived connections. |
| D-12 | The 30 second offer expiry runs inside the database with pg_cron. | Consequence of D-10. Vercel Hobby cron runs at most once a day. |
| D-13 | SMS uses the Twilio trial account. | Sends only to verified numbers, so only a few test contacts work in the demo. The provider sits behind an adapter so it can be replaced. |
| D-14 | API keys and secrets must never leak. Security checks are mandatory on every change. | See `09-security.md`. |
| D-15 | The design follows Apple's Human Interface Guidelines. The visual direction is proposed by Claude and finalised by the owner. | See `11-design-system.md`. |
| D-16 | The anti-pattern list in `11-design-system.md` section 9 is binding. | It includes the ban on em dashes. |
| D-17 | WhatsApp is out of scope. | The owner confirmed it was not requested. Notifications stay SMS only, as in the collection. |
| D-18 | Two Supabase projects: one for development and previews, one for production. | Answers Q-15. Added 2026-10-17. |
| D-19 | Approved proposals P-01, P-02, P-06, P-13, P-14, P-15, P-16, P-17. | Single API function with a router, pnpm, plain CSS with custom elements, public config endpoint, vendored libraries, JSDoc, the technology rule, and "dynamic" meaning live data and state. Added 2026-10-17. P-06 and P-15 are relaxed by D-03 as changed on 2026-10-24: they stay the default, and a UI framework or TypeScript may replace them under `02-trd.md` section 1.2. |
| D-20 | Icons are custom SVGs only, domain and generic. No icon library. | Replaces the generic-icon part of P-08. Added 2026-10-17. |
| D-21 | Only `patient` self-registers in production. Privileged roles self-register only when `ALLOW_PRIVILEGED_SIGNUP=true` (local and preview, so the collection passes). Production privileged accounts are created by a server-side script. | Answers Q-01. Added 2026-10-17. |
| D-22 | Access token lasts 15 minutes. A rotating refresh token keeps the session. Reusing an old refresh token revokes the whole session. Sessions are stored, so logout revokes immediately. Login still returns `token`. | Answers Q-04. Added 2026-10-17. |
| D-23 | The browser keeps both tokens in httpOnly, SameSite=Lax cookies (Secure on HTTPS). Writes authenticated by cookie need a same-origin `Origin` and the `x-careroute-csrf` header. Bearer tokens still work for API clients. | Answers Q-19. Added 2026-10-17. |
| D-24 | Passwords use scrypt and JWTs use HMAC-SHA256, both from Node's built-in `node:crypto`. | Replaces P-05 (argon2id). Added 2026-10-17. |
| D-25 | Rate-limit counters live in a Postgres table, cleaned by pg_cron. | Answers Q-13. Added 2026-10-17. |
| D-26 | CareRoute has three pillars: healthcare discovery, an AI healthcare assistant, and the emergency ambulance system. | From the owner's product vision, 2026-10-24. The tech stack is unchanged. |
| D-27 | Hyderabad, Telangana is the only launch area. Discovery data covers Hyderabad. Medicine price comparison may include online platforms that operate beyond Hyderabad. | Added 2026-10-24. Other cities only after Hyderabad coverage is reliable. |
| D-28 | Discovery shows information and sends the user to the official provider. CareRoute does not book hospital or diagnostic appointments, show live doctor availability or slots, manage beds, sell medicines, take orders or payments, manage pharmacy inventory, or collect diagnostic reports. | Added 2026-10-24. The ambulance system is the one part that runs a real workflow. |
| D-29 | Roles are `patient`, `driver` and `admin` (platform administrator). `hospital_admin` and `dispatcher` are removed. There is no hospital-side portal. | Added 2026-10-24. Closes Q-02. `admin` and `driver` are privileged roles under D-21. What the admin does with the former dispatcher screens is PROPOSED (P-18). |
| D-30 | The emergency flow no longer has a destination hospital step, hospital recommendations, hospital pre-alerts or bed counts. | Added 2026-10-24. `picked_up` no longer takes `destinationHospitalId`. The trip states are unchanged. |
| D-31 | The emergency flow keeps guest SOS, emergency contacts with the SMS tracking link, the public family tracking link, and the medical ID shared with the crew. | Confirmed by the owner, 2026-10-24. |
| D-32 | A driver can accept or reject an offer. | Added 2026-10-24. The reject endpoint is PROPOSED (P-20). |
| D-33 | The AI assistant explains uploaded medical reports in plain language and helps users find doctors, hospitals, pharmacies, medicines and diagnostic centres from a description in natural language. It never prescribes, never recommends a medicine as treatment, never claims a definitive diagnosis, never presents itself as a replacement for a qualified professional, and never promises an outcome or cure. | Added 2026-10-24. Triage (collection folder 6) stays part of the assistant. Privacy of report content is OPEN (Q-25). External sources are OPEN (Q-26). |
| D-34 | The Postman collection was changed to remove the requests for features removed by D-29 and D-30. | Owner approved, 2026-10-24. Details in `CHANGELOG.md`. |
| D-35 | Listing data (hospitals, doctors, pharmacies, diagnostic centres) and medicine data (products and listed prices) are taken from online platforms such as Apollo, MedPlus, Tata 1mg and others. | Owner, 2026-10-24. Answers the source part of Q-22 and closes Q-23. How the data is collected, each platform's terms, and where the collection job runs are OPEN (Q-28). |
| D-36 | Search has three areas: (1) hospitals and doctors; (2) medicines and pharmacies, with price comparison across platforms and pharmacy reviews, location and contact details; (3) diagnostic centres, with reviews, website and related details. | Owner, 2026-10-25. |
| D-37 | Patients keep their own appointment log: appointments they booked elsewhere, with doctor, place, date and time. CareRoute does not book appointments, so D-28 stands. | Owner, 2026-10-25. |
| D-38 | Medicine reminders: the patient enters each medicine, dose, times of day, start and end dates and notes. Reminders show in the app and as browser notifications when the patient allows them. No SMS. | Owner, 2026-10-25. Browsers may not alert while the tab or phone sleeps. |
| D-39 | The medical ID holds identity (photo, full name, date of birth, gender, preferred language), home address, health history (blood group, height, weight, allergies, conditions, current medicines, past surgeries, disabilities, organ donor choice), insurance (provider, policy number) and primary doctor (name, phone). | Owner, 2026-10-25. The owner asked Claude to choose the exact fields within these groups. What the crew sees is PROPOSED (P-25). |
| D-40 | Home is a patient dashboard: upcoming appointments, today's reminders, basic patient details and uploaded documents. | Owner, 2026-10-25. |
| D-41 | Building started on 2026-10-25, full stack, on `main` only (owner, 2026-10-25: no other branches), against the cloud `careroute-dev` project. Login and sign-up pages are part of it. | Owner, 2026-10-25. Replaces "do not start building" and the earlier "no login page" instruction. |
| D-42 | Discovery search needs a signed-in account. | Owner, 2026-10-25. Answers Q-27. |
| D-43 | Listings show both: CareRoute's own patient reviews, and the rating from the source platform, labelled with its source. | Owner, 2026-10-25. Answers Q-24. Moderation rules are PROPOSED (P-28). |
| D-44 | Upload limits stand: documents PDF, JPEG or PNG up to 10 MB, photos JPEG or PNG up to 2 MB. The ambulance crew can see the patient's reports once a booking is confirmed (an offer is accepted), for that emergency only. | Owner, 2026-10-25. Answers Q-11. |
| D-45 | When a patient deletes their account, all of their data is deleted: profile, medical ID, contacts, reminders, appointments, documents, photo, reviews and sessions. | Owner, 2026-10-25. Answers the deletion part of Q-10. Retention periods for data kept while the account exists are still open. Emergency records once ambulances run: see Q-10. |
| D-46 | Listing and price data is gathered from as many internet sources as possible, not only Apollo, MedPlus and Tata 1mg. CareRoute only shows information and prices, never booking or selling. | Owner, 2026-10-25. Answers the source part of Q-28. The owner accepts the terms-of-use risk recorded in `19-setup-checklist.md`. Collection rules are PROPOSED (P-29). |
| D-47 | AI providers run on free plans only, within their limits, relying on the fallback chain (D-07). | Owner, 2026-10-25. Answers Q-17 and Q-25. Free Gemini terms let Google use and review inputs, so the assistant and report explanation must say so before sending anything (see `10-privacy-and-data.md` section 4). |
| D-48 | No landing page for now. The owner builds it later. | Owner, 2026-10-25. |

## 2. Changes forced by locked decisions

These are places where the Postman collection says one thing and a locked decision requires another.

| Collection says | What changes | Status |
| --- | --- | --- |
| Socket.IO room `emergency:<id>` | Supabase Realtime channel named `emergency:<id>`. Same name, different transport. | Follows from D-11 |
| `baseUrl` is `http://localhost:4000/api/v1` | Run the local development server on port 4000 so the collection works unchanged. | PROPOSED |
| Matching "ranks available ambulances by road ETA" | Same behavior. ETA comes from Mapbox instead of a self-hosted router. A PostGIS radius filter runs first to limit how many ambulances are sent to Mapbox. | Follows from D-09 |
| Offers "expire after 30 seconds and move to the next driver" | A database function triggered by pg_cron moves the offer on. | Follows from D-12 |
| Roles `hospital_admin` and `dispatcher`, folders 3, 4, 5 and 7 | Their requests were removed from the collection. Folder 7 (dispatch) is gone and the old folder 8 is now folder 7. | Done, D-34 |
| Hospitals are created by `hospital_admin` in folder 3 | Hospitals and doctors are listing data managed by the admin. The collection now reads them from seed data: "Hospitals near me" stores the first result's id. | Done, D-34 |
| "Driver: choose hospital and mark picked up" sends `destinationHospitalId` | The request is now "Driver: mark picked up" with only `status`. | Done, D-34 |

## 3. Proposed decisions (need owner approval)

Approved on 2026-10-17 (now LOCKED as D-19): P-01, P-02, P-06, P-13, P-14, P-15, P-16, P-17. Still proposed: P-03, P-04, P-07, P-08 (changed by D-20), P-09, P-10, P-11 (changed by D-29), P-12 (changed by D-30), and the new P-18 to P-24.

| ID | Proposal | Reason |
| --- | --- | --- |
| P-01 | The REST API is one Vercel function at `api/v1/[...path].js` with an internal router, in the same repository as the static frontend in `public/`. | One deploy. One function avoids any cap on how many functions a deployment may hold. |
| P-02 | Package manager is pnpm. | Same as the DeepInterview project. |
| P-03 | Validation with Zod. Invalid input returns HTTP 422, as the collection requires. | Collection test "Invalid coordinates rejected" expects 422. |
| P-04 | Database access through SQL migrations (Supabase CLI) and the `postgres` driver, with Zod at the boundary. | PostGIS queries are easier to write and review as plain SQL. |
| P-05 | Passwords hashed with argon2id. | Current standard recommendation. |
| P-06 | Plain CSS driven by custom property tokens. Native HTML elements first, native `dialog`, and Web Components (custom elements) for shared widgets like the Care Thread. No CSS framework and no component library unless one is adopted under D-03. | Fits the HTML, CSS and JavaScript foundation and meets the "no untouched shadcn" rule by not using it. |
| P-07 | Fonts: the operating system font stack, which is San Francisco on Apple devices. No downloaded font family. | Matches Apple's guidelines and avoids the banned font choices. |
| P-08 | Icons: a small custom set for ambulance, hospital, report and similar domain concepts, plus generic control icons copied as SVG files from one non-Lucide open set, used sparingly. Set not yet picked. No icon library runs in the browser. | Meets the "no Lucide everywhere" rule. |
| P-09 | Testing with Vitest, Playwright, axe, and Newman running the Postman collection as contract tests. | The collection already contains assertions. |
| P-10 | Authenticated roles receive live updates through private Supabase Realtime channels. The anonymous family tracking page polls `GET /emergencies/{id}/track`. | Avoids giving anonymous visitors a realtime connection. |
| P-11 | Medical report endpoints and tables in `05-api-spec.md` section 4 and `04-data-model.md`. | The collection has no report endpoints. |
| P-12 | Visual direction in `11-design-system.md` (palette, type scale, spacing, the "Care Thread" concept). | Owner asked Claude to suggest, then will finalise. |
| P-13 | Browser configuration comes from `GET /api/v1/config`, which returns only allow-listed public values. Public variables are named with the prefix `PUBLIC_`. | There is no build step to inject variables. |
| P-14 | Browser libraries are vendored into `public/vendor/` at pinned versions. No runtime CDN. | Tight Content Security Policy and less supply chain risk. |
| P-15 | Type information through JSDoc and optional editor checking. No TypeScript in the build unless adopted under D-03. | Keeps JavaScript while catching mistakes early. |
| P-16 | The technology allow-list and approval rule in `02-trd.md` section 1.2. Charts are hand-built SVG unless a library is approved. | Implements "other technology where really required". |
| P-17 | "Dynamic designs" means interfaces driven by live data and user state, with responsive layout and the allowed motion list. It does not include the banned effects (scroll reveals, cursor effects, opacity fades on buttons). | The owner's phrase could mean more animation. Confirm. |
| P-18 | The platform admin takes over the former dispatcher screens: live list of active emergencies, nearby ambulances, and analytics (total requests, time to assign, response time by hour, failed matches). Endpoints move under `/admin`. | The owner had no preference. Without it, nobody sees failed matches or stuck cases. |
| P-19 | Discovery endpoints and tables for hospitals, doctors, pharmacies, diagnostic centres and medicines, in `05-api-spec.md` section 4 and `04-data-model.md`. Search uses Postgres full-text search and the `pg_trgm` extension for name matching, plus PostGIS for distance. | The vision needs search with filters. Both are Postgres features, so no new service. |
| P-20 | `POST /emergencies/{id}/reject` for the driver. The offer becomes `declined` and the next offer opens at once. | Implements D-32. Not in the collection. |
| P-21 | Report explanation runs on a report the patient already uploaded (D-06), through the same model chain (D-07), and returns a structured explanation. The explanation is not stored by default. | Implements the report part of D-33. Blocked by Q-25. |
| P-22 | Admin endpoints to list and disable user accounts and to create, edit and hide listings. Admin screens never show medical ID, reports or emergency notes. | Implements the admin role in D-29 without giving it health data. |
| P-23 | The discovery assistant: the model turns the user's text into a structured search (speciality, facility type, area). The server runs that search on CareRoute's own data. The model has no tools and no network access. | Implements the discovery part of D-33 without trusting model output as listing data. External sources wait for Q-26. |
| P-24 | Every listing stores its source address and the date it was last checked, and the page shows "Checked on {date}". Contact links open the provider's phone, email or official website. | Users act on this data in a health context, so its age must be visible. |
| P-25 | During an active emergency the assigned crew sees, when `shareWithCrew` is on: name, photo, age, gender, blood group, allergies, conditions, current medicines, disabilities and primary doctor. Never the home address beyond the pickup point, never insurance, never past surgeries unless the patient adds them to notes. | Keeps crew access to what changes care in the first minutes (D-39). |
| P-26 | Patient photos and uploaded documents go to private Supabase Storage buckets, opened with signed links that expire in minutes. Photos are limited to JPEG or PNG under 2 MB. | Same rules as `08-medical-reports.md`. |
| P-27 | Until `.env.local` holds the careroute-dev keys, the local dev server runs on an in-memory store seeded with sample data and says so in its log and on screen. Production refuses to start without `DATABASE_URL`. | Lets the frontend run before keys exist without pretending to be connected. |
| P-28 | CareRoute reviews: one review per patient per listing, rating 1 to 5 and optional text up to 1,000 characters, editable and deletable by its author, shown with first name only. Reports of abuse hide a review until an admin checks it. | Implements D-43 without exposing who reviewed what. |
| P-29 | Collection rules: prefer open data (OpenStreetMap, government lists such as Jan Aushadhi and NPPA prices) and official feeds; read each site's robots.txt and honour it; identify the collector honestly; at most one request every few seconds per site; never sign in to a site, never get around bot protection or captchas; store only listing facts and prices with source and checked date, never copy reviews text or images. | Gathers widely (D-46) while keeping legal and technical risk as low as possible. |

## 4. Open questions

Each of these blocks specific work. The "Blocks" column says what cannot start until the answer exists.

| ID | Question | Blocks |
| --- | --- | --- |
| Q-03 | Can a driver own more than one ambulance? | Ambulance work |
| Q-05 | Full list of `emergencyType` values. The collection shows `cardiac`, `accident` and `other`. | Emergency work |
| Q-06 | Name of the status for an SOS that nobody accepted. The old collection mentioned "failed matches" in analytics but no state name. | Lifecycle, analytics |
| Q-07 | How many offer attempts before a request is marked failed, and what anyone can do about it. There is no manual assignment endpoint. | Matching work |
| Q-08 | Scoring weights for ambulance ranking. The collection lists road ETA and type but not the weights. (Hospital recommendation was removed by D-30.) | Matching work |
| Q-09 | Tracking token lifetime and when it stops working. | Tracking work |
| Q-10 | Data retention periods while an account exists, and what happens to emergency records after deletion once ambulances run. Account deletion itself is decided (D-45). | Privacy doc |
| Q-12 | How to prevent accidental SOS taps without slowing a real emergency. Options in `11-design-system.md`. | SOS screen |
| Q-14 | How Supabase Realtime private channels are authorized, given that login uses our own JWT and not Supabase Auth. | Realtime work |
| Q-16 | Domain name and security contact address. | SECURITY.md, launch |
| Q-20 | MapTiler's free plan is for non-commercial use. A real launch needs the paid plan (about 25 US dollars a month) or another tile source. Decide before any launch. | Launch |
| Q-18 | Custom domain, and whether Vercel's Hobby plan terms allow this demo's intended use. | Deployment |
| Q-21 | The vision says CareRoute should work with real ambulance operators and drivers. D-04 says this is a demo with real integrations out of scope. Does the demo stay synthetic, with real operators as a later phase? Real dispatch needs partnerships, driver checks, legal review and coverage that a free-tier demo cannot promise. | Any use with real ambulances or real patients |
| Q-22 | Doctor profiles taken from online platforms (D-35) describe real people, so they are personal data. Which fields may be published, on what basis, and how does a doctor ask for removal? This also changes the demo rule that only synthetic data is used (`10-privacy-and-data.md` section 1). | Storing real doctor data (WP-3) |
| Q-26 | The vision says the assistant may use external information sources. Which ones, through what service, at what cost, and under what terms? | Assistant work beyond CareRoute's own data |
| Q-28 | Where the collection job runs. Vercel Hobby cron runs once a day with short function time limits, and D-10 allows only Vercel and Supabase. Options: daily Vercel cron in small batches, Supabase Edge Functions with pg_cron, or GitHub Actions (outside D-10, needs approval). Sources and rules are decided (D-46, P-29). | Data collection |

## 5. How to change this file

1. Change the status of an item only when the owner has said so in chat.
2. Add a dated line to `CHANGELOG.md` for every change to a LOCKED item.
3. When a question is answered, move it to the LOCKED table and update every document that depended on it.
