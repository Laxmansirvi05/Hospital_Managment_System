# Technical requirements: CareRoute

Read `00-decisions.md` first. Labels used here: LOCKED, COLLECTION, PROPOSED, OPEN.

## 1. Stack

HTML, CSS and JavaScript are the foundation (D-03). Other technology is added only where it is really required, under the rule in section 1.2.

### 1.1 Stack table

| Layer | Choice | Status |
| --- | --- | --- |
| Frontend foundation | HTML, CSS, JavaScript (ES modules). No UI framework. No build step by default. | LOCKED (D-03) |
| Backend language | JavaScript on Node.js, as Vercel Functions | LOCKED (D-03, D-10) |
| API | One Vercel function at `api/v1/[...path].js` with an internal router, serving `/api/v1/*` | PROPOSED (P-01) |
| Database | Supabase PostgreSQL with PostGIS | LOCKED (D-10) |
| File storage | Supabase Storage, private buckets | LOCKED (D-10) |
| Realtime | Supabase Realtime | LOCKED (D-11) |
| Scheduled work | pg_cron inside the database | LOCKED (D-12) |
| Map rendering | MapLibre GL JS with MapTiler tiles | LOCKED (D-08) |
| Routing and ETA | Mapbox Directions and Matrix, server side only | LOCKED (D-09) |
| Triage model | Gemini, then Groq, then OpenRouter | LOCKED (D-07) |
| SMS | Twilio trial behind an adapter | LOCKED (D-13) |
| Styling | Plain CSS with custom property tokens, cascade layers, container queries | PROPOSED (P-06) |
| UI components | Native HTML elements first. Custom elements (Web Components) for shared widgets such as the Care Thread. Native `dialog` for dialogs. | PROPOSED (P-06) |
| Type information | JSDoc comments, optional `// @ts-check` in the editor. No TypeScript in the build. | PROPOSED (P-15) |
| Server validation | Zod | PROPOSED (P-03) |
| Browser validation | HTML constraint validation for usability. The server is authoritative. | PROPOSED |
| DB access | SQL migrations (Supabase CLI), `postgres` driver | PROPOSED (P-04) |
| Password hashing | argon2id | PROPOSED (P-05) |
| Package manager | pnpm, for server dependencies, tooling and copying vendored browser libraries | PROPOSED (P-02) |
| Lint and format | ESLint and Prettier, development only | PROPOSED |
| Tests | Vitest, Playwright, axe, Newman | PROPOSED (P-09) |

TypeScript, Next.js, Tailwind CSS and Radix from the first version of these documents are no longer part of the stack.

### 1.2 Rule for adding other technology

A library or tool is added only when all of these are true:

1. There is a written need that platform features (HTML, CSS, JavaScript, the browser, Node, Postgres) cannot meet in reasonable effort.
2. The owner approved it.
3. It is added to the table above with a one-line reason, and to `00-decisions.md`.
4. Browser libraries are vendored (section 2), pinned to an exact version, and checked against `09-security.md` section 10.

Libraries already justified by a locked decision: MapLibre GL JS (D-08) and the Supabase JavaScript client for Realtime (D-11). Charts are hand-built SVG unless the owner approves a library.

## 2. Repository layout (PROPOSED)

```
/
  public/                   everything the browser can fetch. Treat all of it as public.
    index.html              home, guest SOS entry
    sos/                    guest SOS and patient SOS pages
    track/                  family tracking page
    patient/  driver/  hospital/  dispatch/    one folder per role, one HTML file per screen
    css/
      tokens.css            design tokens as custom properties, light and dark
      base.css              reset, typography, layout primitives
      components/           one CSS file per component
      pages/                page specific CSS
    js/
      api.js                fetch wrapper for /api/v1
      session.js            sign-in state and role guard for pages
      realtime.js           Supabase Realtime subscription
      map.js                MapLibre setup
      components/           custom elements: care-thread, status-label, eta-block, ...
      pages/                one module per page
    vendor/                 pinned third-party browser files with version and hash notes
    icons/                  custom domain icons (SVG)
  api/
    v1/[...path].js         the only serverless entry point, calls server/router.js
  server/                   code that runs only on the server. Never served.
    router.js               route table, explicit order
    routes/                 one module per resource
    auth/  db/  matching/  triage/  emergency/
    adapters/               sms, llm, routing: one interface each, one file per provider
    config.js               the only reader of server secrets
    log.js                  redacting logger
  supabase/
    migrations/             forward-only SQL
    seed.sql                local synthetic data
  tests/
  postman/                  contract: collection and environment
  docs/
  .claude/                  agents and skills
  vercel.json               headers, cache rules, rewrites
```

Rules:

1. Anything a browser must read lives in `public/`. Anything secret lives outside it.
2. Files in `server/` are only imported by `api/` and tests. A test fails if any file in `public/` references `server/`, a server secret name, or a provider key.
3. Every HTML file is public. No page contains data, tokens or secrets. Pages fetch data from the API after sign-in.
4. Role pages check the session and redirect, but that is a convenience. The API enforces the real access rules.

## 3. How the interface works

"Dynamic" in this project means interfaces that are driven by live data and user state, not decoration.

- Multi-page: each screen is an HTML file with a small JavaScript module. No client side router and no framework runtime, so pages stay small on weak networks.
- State-driven rendering: a module holds the state, a render function writes it to the page using `textContent`, `template` cloning and attribute updates. Never `innerHTML` with data.
- Live updates: Supabase Realtime updates the Care Thread, ETA, map marker and lists without reloading. Polling is the fallback.
- Responsive: layouts use CSS grid, container queries and the spacing scale. Light and dark follow the system setting with a manual override.
- Motion: only the allowed list in `11-design-system.md` section 6.
- Progressive enhancement for the most important path: the guest SOS form is a real `form` that posts to the API and works with minimal JavaScript.

### 3.1 Browser configuration without a build step

There is no build to inject environment variables. The page loads public configuration from `GET /api/v1/config`, which returns only the allow-listed public values (Supabase URL, Supabase anon key, MapTiler key) taken from server environment variables at request time. Nothing else is ever returned. The allow-list is in `09-security.md` section 3.1. PROPOSED (P-13).

### 3.2 Third-party browser files

Browser libraries are copied into `public/vendor/` by a script, pinned to an exact version, with the source and version recorded next to each file. No library is loaded from a CDN at runtime. This keeps the Content Security Policy tight and removes a supply chain risk. PROPOSED (P-14).

## 4. API conventions

1. Base path `/api/v1`. COLLECTION.
2. JSON request and response bodies. Field names are camelCase, as in the collection.
3. Lists are returned as an object with a named array, for example `{ "hospitals": [...] }`, never a bare array. COLLECTION.
4. Status codes seen in the collection: 200, 201, 204, 401, 403, 409, 422. Use them as the collection does.
5. Validation errors return 422 with a body that names the failing field. The collection test checks that the text "location" appears for a bad location. COLLECTION.
6. Error body shape: `{ "error": { "code": "string", "message": "string", "fields": { "name": "reason" } } }`. PROPOSED.
7. Timestamps are ISO 8601 in UTC. COLLECTION.
8. Distances in kilometers, durations in seconds, speed in km per hour. COLLECTION (`distanceKm`, `etaSeconds`, `speedKmph`).
9. Route order: the router registers static paths such as `/emergencies/mine` and `/emergencies/driver/inbox` before `/emergencies/:id`, and a test proves they are never read as an id.
10. Every route declares its allowed roles next to its handler and a test proves other roles get 403.

## 5. Authentication and authorization

- Roles: `patient`, `driver`, `hospital_admin`, `dispatcher`. COLLECTION.
- Token: JWT in the `Authorization: Bearer` header. Lifetime, refresh and browser storage are OPEN (Q-04, Q-19).
- Role is read from the verified token and re-checked against the database for privileged actions.
- Ownership checks, not only role checks: a patient reads only their own emergency, a driver changes only the trip they accepted, a hospital admin edits only their own hospital (Q-02).
- The public tracking endpoint authorizes by `trackingToken` only. See `09-security.md`.
- Registration of privileged roles is OPEN (Q-01).

## 6. Performance and reliability requirements

| Requirement | Value | Source |
| --- | --- | --- |
| Response time for every endpoint | Under 2 seconds | COLLECTION |
| Driver GPS ping interval | 3 to 5 seconds | COLLECTION |
| Offer expiry | 30 seconds | COLLECTION |
| Hospital search | Nearest first, PostGIS distance | COLLECTION |
| Other latency, throughput and availability targets | Not set | OPEN, agree with owner |

Do not publish uptime or latency claims anywhere in the product until measured.

## 7. External services and failure behavior

Every external call goes through an adapter with a timeout, a typed error, and a defined fallback.

| Service | Used for | If it fails |
| --- | --- | --- |
| Mapbox | Road ETA, distance matrix, route | Rank by PostGIS straight-line distance, mark the ETA as an estimate in the response and the UI |
| Gemini | Triage | Try Groq, then OpenRouter, then return the rule-layer result only |
| Groq | Triage fallback | Try OpenRouter |
| OpenRouter | Triage second fallback | Return the rule-layer result only |
| Twilio | SMS to emergency contacts | Record failure in `sms_outbox`, show the tracking link to the patient to share by hand, keep the emergency running |
| MapTiler | Map tiles | Show the map area with a plain message and keep the status panels working |
| Supabase Realtime | Live updates | Client falls back to polling the same read endpoints |

The emergency flow itself must never depend on SMS, the model or tiles. Only the database and the Mapbox-or-fallback ranking are on the critical path.

## 8. Code standards

1. JavaScript as ES modules. `const` by default, strict equality, no `eval`, no `Function` constructor, no implicit globals.
2. Exported functions have JSDoc with parameter and return types. Shared shapes are described once with `@typedef`.
3. One Zod schema per request body and query, in `server/routes`. Response objects are built from explicit field lists.
4. No secret is read outside `server/config.js`. That file validates every variable at startup with Zod and fails fast if one is missing.
5. No `console.log` of request bodies, tokens, phone numbers, medical data or locations. Use `server/log.js`, which redacts by key name.
6. SQL lives in `server/db`. No string-built SQL. Parameters only.
7. Browser code writes data to the page with `textContent` or cloned templates. `innerHTML`, `outerHTML` and `insertAdjacentHTML` are not used with data.
8. Migrations are forward-only and reviewed. See the `db-migration` skill.
9. CSS uses tokens, never raw hex values or arbitrary pixel numbers. See `11-design-system.md`.
10. Comments explain why, not what. Match the density of the surrounding code.

## 9. Configuration

All server configuration is environment variables. The full matrix with scope is in `16-deployment-and-environments.md`. A `.env.example` file with placeholder values only will be created in WP-0. Real values are never committed.

## 10. Known technical risks

| Risk | Detail | Action |
| --- | --- | --- |
| Driver page in the background | Web pages can lose location updates and timers when the screen locks or the tab is hidden. The 3 to 5 second ping rule cannot be guaranteed then. | The trip screen asks for the Screen Wake Lock API and tells the driver to keep the screen on. Test on real phones in WP-4. Tell the owner what browsers cannot do. |
| Serverless fit for GPS pings | Each ping is one function call and one write, per driver, every 3 to 5 seconds | Measure in WP-5. If limits are hit, lower the interval only after agreeing with the owner |
| Function count limits | A Vercel plan may cap how many functions a deployment can hold. Sources disagree on the Hobby limit. | The design uses one function with an internal router, so the cap does not matter. Confirm in WP-0. |
| Cold starts of the single API function | One larger function loads all routes | Keep imports light, lazy load adapters, measure the SOS path against the 2 second rule |
| Realtime authorization with a custom JWT | Supabase private channels check Postgres policies against the JWT | Open question Q-14. Decide before WP-5 |
| pg_cron interval | Offer expiry needs a schedule shorter than a minute | Confirm the installed pg_cron version supports second-level schedules before relying on it |
| Mapbox matrix size limits | A request can hold only a limited number of coordinates | Check the current limit in Mapbox documentation, pre-filter with PostGIS |
| Free Supabase project pausing | Projects with low activity pause | See `16-deployment-and-environments.md` section 6 |
| No compile step | Mistakes that a type checker would catch appear at runtime | Zod at every boundary, JSDoc checking in the editor, ESLint, and the tests in `14-testing-strategy.md` |
| Public HTML | Every page file can be fetched by anyone | Pages hold no data or secrets. The API enforces access. |

## 11. Definition of technically done

A change is done when: it matches the API spec, lint passes, tests pass, the contract collection passes, the security checklist in `09-security.md` section 12 passes, the design review passes for UI work, and docs that describe it are updated.
