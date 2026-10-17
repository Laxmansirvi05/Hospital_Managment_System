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
| D-02 | Web only, responsive. One web app, no native mobile apps. | Patient and driver views are mobile-first. Hospital and dispatcher views are desktop dashboards. |
| D-03 | HTML, CSS and JavaScript are the foundation, for the frontend and for the Node.js API. Other technology is used only where it is really required, with the owner's approval. TypeScript and Next.js are not used. | Changed on 2026-10-17. Earlier text said Node.js, TypeScript and Next.js. The owner wants dynamic, live designs on this foundation. Rule for adding technology: `02-trd.md` section 1.2. |
| D-04 | Scope is a demo that is built to production standard. | Real hospital integrations and uptime commitments are out of scope. Security, privacy, accessibility and code quality are not reduced for the demo. |
| D-05 | English only for now. | The triage `language` field stays in the API but only `en` is built. |
| D-06 | Medical reports are a new feature. | Patients upload lab reports, prescriptions and scans. Detail is in `08-medical-reports.md`. |
| D-07 | Triage language model order: Gemini API first, Groq second, OpenRouter third. | A fixed red-flag rule layer runs before any model. See `07-ai-triage.md`. |
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
| D-19 | Approved proposals P-01, P-02, P-06, P-13, P-14, P-15, P-16, P-17. | Single API function with a router, pnpm, plain CSS with custom elements, public config endpoint, vendored libraries, JSDoc, the technology rule, and "dynamic" meaning live data and state. Added 2026-10-17. |
| D-20 | Icons are custom SVGs only, domain and generic. No icon library. | Replaces the generic-icon part of P-08. Added 2026-10-17. |
| D-21 | Only `patient` self-registers in production. Privileged roles self-register only when `ALLOW_PRIVILEGED_SIGNUP=true` (local and preview, so the collection passes). Production privileged accounts are created by a server-side script. | Answers Q-01. Added 2026-10-17. |
| D-22 | Access token lasts 15 minutes. A rotating refresh token keeps the session. Reusing an old refresh token revokes the whole session. Sessions are stored, so logout revokes immediately. Login still returns `token`. | Answers Q-04. Added 2026-10-17. |
| D-23 | The browser keeps both tokens in httpOnly, SameSite=Lax cookies (Secure on HTTPS). Writes authenticated by cookie need a same-origin `Origin` and the `x-careroute-csrf` header. Bearer tokens still work for API clients. | Answers Q-19. Added 2026-10-17. |
| D-24 | Passwords use scrypt and JWTs use HMAC-SHA256, both from Node's built-in `node:crypto`. | Replaces P-05 (argon2id). Added 2026-10-17. |
| D-25 | Rate-limit counters live in a Postgres table, cleaned by pg_cron. | Answers Q-13. Added 2026-10-17. |

## 2. Changes forced by locked decisions

These are places where the Postman collection says one thing and a locked decision requires another.

| Collection says | What changes | Status |
| --- | --- | --- |
| Socket.IO room `emergency:<id>` | Supabase Realtime channel named `emergency:<id>`. Same name, different transport. | Follows from D-11 |
| `baseUrl` is `http://localhost:4000/api/v1` | Run the local development server on port 4000 so the collection works unchanged. | PROPOSED |
| Matching "ranks available ambulances by road ETA" | Same behavior. ETA comes from Mapbox instead of a self-hosted router. A PostGIS radius filter runs first to limit how many ambulances are sent to Mapbox. | Follows from D-09 |
| Offers "expire after 30 seconds and move to the next driver" | A database function triggered by pg_cron moves the offer on. | Follows from D-12 |

## 3. Proposed decisions (need owner approval)

Approved on 2026-10-17 (now LOCKED as D-19): P-01, P-02, P-06, P-13, P-14, P-15, P-16, P-17. Still proposed: P-03, P-04, P-07, P-08 (changed by D-20), P-09, P-10, P-11, P-12.

| ID | Proposal | Reason |
| --- | --- | --- |
| P-01 | The REST API is one Vercel function at `api/v1/[...path].js` with an internal router, in the same repository as the static frontend in `public/`. | One deploy. One function avoids any cap on how many functions a deployment may hold. |
| P-02 | Package manager is pnpm. | Same as the DeepInterview project. |
| P-03 | Validation with Zod. Invalid input returns HTTP 422, as the collection requires. | Collection test "Invalid coordinates rejected" expects 422. |
| P-04 | Database access through SQL migrations (Supabase CLI) and the `postgres` driver, with Zod at the boundary. | PostGIS queries are easier to write and review as plain SQL. |
| P-05 | Passwords hashed with argon2id. | Current standard recommendation. |
| P-06 | Plain CSS driven by custom property tokens. Native HTML elements first, native `dialog`, and Web Components (custom elements) for shared widgets like the Care Thread. No CSS framework and no component library. | Fits the HTML, CSS and JavaScript foundation and meets the "no untouched shadcn" rule by not using it. |
| P-07 | Fonts: the operating system font stack, which is San Francisco on Apple devices. No downloaded font family. | Matches Apple's guidelines and avoids the banned font choices. |
| P-08 | Icons: a small custom set for ambulance, hospital, report and similar domain concepts, plus generic control icons copied as SVG files from one non-Lucide open set, used sparingly. Set not yet picked. No icon library runs in the browser. | Meets the "no Lucide everywhere" rule. |
| P-09 | Testing with Vitest, Playwright, axe, and Newman running the Postman collection as contract tests. | The collection already contains assertions. |
| P-10 | Authenticated roles receive live updates through private Supabase Realtime channels. The anonymous family tracking page polls `GET /emergencies/{id}/track`. | Avoids giving anonymous visitors a realtime connection. |
| P-11 | Medical report endpoints and tables in `05-api-spec.md` section 4 and `04-data-model.md`. | The collection has no report endpoints. |
| P-12 | Visual direction in `11-design-system.md` (palette, type scale, spacing, the "Care Thread" concept). | Owner asked Claude to suggest, then will finalise. |
| P-13 | Browser configuration comes from `GET /api/v1/config`, which returns only allow-listed public values. Public variables are named with the prefix `PUBLIC_`. | There is no build step to inject variables. |
| P-14 | Browser libraries are vendored into `public/vendor/` at pinned versions. No runtime CDN. | Tight Content Security Policy and less supply chain risk. |
| P-15 | Type information through JSDoc and optional editor checking. No TypeScript in the build. | Keeps JavaScript while catching mistakes early. |
| P-16 | The technology allow-list and approval rule in `02-trd.md` section 1.2. Charts are hand-built SVG unless a library is approved. | Implements "other technology where really required". |
| P-17 | "Dynamic designs" means interfaces driven by live data and user state, with responsive layout and the allowed motion list. It does not include the banned effects (scroll reveals, cursor effects, opacity fades on buttons). | The owner's phrase could mean more animation. Confirm. |

## 4. Open questions

Each of these blocks specific work. The "Blocks" column says what cannot start until the answer exists.

| ID | Question | Blocks |
| --- | --- | --- |
| Q-02 | How is a hospital admin linked to one hospital? The collection does not say. Without a link, any hospital admin could edit any hospital's beds. | Hospital work |
| Q-03 | Can a driver own more than one ambulance? | Ambulance work |
| Q-05 | Full list of `emergencyType` values. The collection shows `cardiac`, `accident` and `other`. | Emergency work |
| Q-06 | Name of the status for an SOS that nobody accepted. The collection mentions "failed matches" in analytics but no state name. | Lifecycle, analytics |
| Q-07 | How many offer attempts before a request is marked failed, and what the dispatcher can do about it. The collection has no manual assignment endpoint. | Matching work |
| Q-08 | Scoring weights for ambulance ranking and hospital recommendation. The collection lists the factors but not the weights. | Matching work |
| Q-09 | Tracking token lifetime and when it stops working. | Tracking work |
| Q-10 | Data retention periods and the deletion process for accounts, emergencies and reports. | Privacy doc, reports |
| Q-11 | Medical report limits: allowed file types, maximum size, and who can see a report during an emergency. | Reports work |
| Q-12 | How to prevent accidental SOS taps without slowing a real emergency. Options in `11-design-system.md`. | SOS screen |
| Q-14 | How Supabase Realtime private channels are authorized, given that login uses our own JWT and not Supabase Auth. | Realtime work |
| Q-16 | Domain name and security contact address. | SECURITY.md, launch |
| Q-17 | Partly answered 2026-10-17. Gemini's unpaid terms allow Google to use and human-review inputs. Groq and OpenRouter free routes were checked only through secondary sources. Decision needed: the demo sends synthetic symptom text only, and real patient text waits for a paid Gemini plan or a different provider order. Is that acceptable? | AI triage |
| Q-20 | MapTiler's free plan is for non-commercial use. A real launch needs the paid plan (about 25 US dollars a month) or another tile source. Decide before any launch. | Launch |
| Q-18 | Custom domain, and whether Vercel's Hobby plan terms allow this demo's intended use. | Deployment |

## 5. How to change this file

1. Change the status of an item only when the owner has said so in chat.
2. Add a dated line to `CHANGELOG.md` for every change to a LOCKED item.
3. When a question is answered, move it to the LOCKED table and update every document that depended on it.
