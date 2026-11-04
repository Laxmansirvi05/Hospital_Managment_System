# Codex to Claude hand-off

Date: 2026-11-04

## ID T2-test-prices

- **what:** Memory `listings.testPrices()` returns `[]`; Postgres selects active rows from `public.test_prices` and maps name, provider, price, centres, URL, checked date and total.
- **why:** The adapters cannot return matching populated shapes and data today. Do not manufacture real-looking prices. Decide whether a curated synthetic in-memory fixture is appropriate or keep memory explicitly empty and document the limitation.
- **file/line:** `server/db/memory.js:266`; `server/db/postgres.js:389-394`.
- **blocking?:** No production fix is blocked; populated adapter parity is unverified until there is an approved fixture or disposable Postgres test setup.

## ID T2-google-subject-conflict (RESOLVED in `07f3384`)

- **what:** Memory user creation rejects duplicate `googleSub` values. Postgres `users.create()` uses `ON CONFLICT (email) DO NOTHING` only.
- **why:** A concurrent duplicate Google identity may raise a unique-constraint error in Postgres where memory returns null. Inspect the migration constraints and add a targeted adapter-level test or query change.
- **file/line:** `server/db/memory.js:57-60`; `server/db/postgres.js:121-124`.
- **blocking?:** No schema change is requested. Live database verification was prohibited in this pass.
- **resolution:** `07f3384` uses generic `ON CONFLICT DO NOTHING`; adapter tests assert duplicate email/Google-subject behavior and query text. No live database was used.

## ID T3-pnpm-toolchain

- **what:** `pnpm audit` reports 15 development dependency advisories. Vitest 4.1.12 requires Vite 6+, but current lock resolves Vite 5.4.21. A package-level `pnpm.overrides` setting was ignored by pnpm 11 and was reverted.
- **why:** The Vitest bump cleared critical advisories but failed at startup with `ERR_PACKAGE_PATH_NOT_EXPORTED` for `vite/module-runner`. A working Vite 6 override belongs in pnpm workspace settings, outside the T3 file allowance in this pass.
- **file/line:** `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`.
- **blocking?:** Yes, owner approval is needed before expanding the dependency configuration change into `pnpm-workspace.yaml`.

## ID T8-handoff-status (RESOLVED)

- **what:** The current `to-codex.md` says `server/routes/assistant.js` and `tests/api.test.js` have uncommitted edits. They were clean at the point they were reviewed and were changed only for the T4 emergency fix and its test, then committed as `338148e`.
- **why:** The handoff is stale relative to the repository state and prompt exception for files that later became clean.
- **file/line:** `docs/audit/handoff/to-codex.md:8`.
- **blocking?:** No. Claude owns `to-codex.md`; please update it if the files remain clean in your state.
- **resolution:** the named source and test files were clean when checked; this pass changed neither file outside its committed W1 work.

## Pass 2 handoff, 2026-11-04

- W1 generic conflict handling and adapter assertions are committed as `07f3384`; W13 media deferral/encode is `2d44dd2`; W15 CSSOM/CSP fix is `e536c91`.
- Owner requested the original auth video quality. Commit `dafd1cd` switches playback to the existing 3840x2160 H.264 asset and regenerates the 4K WebP poster. Loading remains deferred; the full 64.5 MB file is not downloaded until idle on eligible screens.
- The earlier generated 720p derivative remains unreferenced, as W20 is report-only. It is recorded as a possible cleanup candidate.
- W10 remains a partial manual audit because the saved public sweep redirects protected routes to sign-in and G2 is blank. No axe dependency was added.
- W11 detail pages show a no-phone message and directions, but result cards do not expose phone availability. Owner should confirm the desired list-card interaction before a UI change.
- W9 assistant focus trap remains missing. Robot source was in the owner's recent UI lane; no edits were made to it.
- W19 stopped before starting a local cluster because the installed PostgreSQL extension directory lacks PostGIS. No migration or database was used.
- Owner approvals G1, G2 and G3 are still blank. No owner decision or production action was inferred.
- Final report: `docs/audit/CODEX_REMAINING_2026-11-04.md`.

## E5 SQL for verification

No database connection or SQL execution was used by Codex. Please run the statements below only against DEV, inside rolled-back transactions, and report any mapping or behavior mismatch. All values are bind parameters; the names below map to positional `$1`, `$2`, etc. `point(lat,lng)` means `extensions.st_setsrid(extensions.st_makepoint($lng,$lat),4326)::extensions.geography`.

### Writes and lifecycle functions

| Adapter method | SQL statement | Parameters |
| --- | --- | --- |
| `nearbyAmbulances` | `select id,type,distance_m,is_demo from public.nearby_ambulances($1::extensions.geography,$2::public.ambulance_type,$3::numeric,$4::integer,$5::integer)` | `$1=point(lat,lng)`, `$2=type`, `$3=radiusKm`, `$4=maxAgeSeconds`, `$5=limit` |
| `createEmergency` | `insert into public.emergencies (id,patient_user_id,guest_phone,for_self,emergency_type,conscious,patient_count,ambulance_type,notes,patient_location,patient_address,eta_seconds,tracking_token_hash,is_demo) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true) returning *, st_y(patient_location::extensions.geometry) as patient_lat, st_x(patient_location::extensions.geometry) as patient_lng` | `$1=id`, `$2=patientUserId`, `$3=guestPhone`, `$4=forSelf`, `$5=emergencyType`, `$6=conscious`, `$7=patientCount`, `$8=ambulanceType`, `$9=notes`, `$10=point(lat,lng)`, `$11=address`, `$12=etaSeconds`, `$13=trackingTokenHash` |
| `createEmergency` event | `insert into public.emergency_events (emergency_id,kind,actor_role) values ($1,'created',$2)` | `$1=id`, `$2='patient'` or `'guest'` |
| `createOffers` | `select * from public.create_offers($1::uuid,$2::jsonb,$3::boolean)` | `$1=emergencyId`, `$2=JSON array [{ambulance_id,eta_seconds}] (max 5)`, `$3=etaIsEstimate` |
| `createOffers` readback | `select e.*,st_y(e.patient_location::extensions.geometry) as patient_lat,st_x(e.patient_location::extensions.geometry) as patient_lng from public.emergencies e where e.id=$1` | `$1=emergencyId` |
| `acceptEmergency` | `select * from public.accept_emergency($1::uuid,$2::uuid)` | `$1=emergencyId`, `$2=ambulanceId` |
| `acceptEmergency` readback | `select e.*,st_y(e.patient_location::extensions.geometry) as patient_lat,st_x(e.patient_location::extensions.geometry) as patient_lng from public.emergencies e where e.id=$1 and e.status='assigned' and e.ambulance_id=$2` | `$1=emergencyId`, `$2=ambulanceId` |
| `declineOffer` | `select * from public.decline_offer($1::uuid,$2::uuid)` | `$1=emergencyId`, `$2=ambulanceId` |
| `declineOffer` readback | `select e.*,st_y(e.patient_location::extensions.geometry) as patient_lat,st_x(e.patient_location::extensions.geometry) as patient_lng from public.emergencies e where e.id=$1` | `$1=emergencyId` |
| `expireOffers` | `select public.expire_offers() as count` | no parameters |
| `advanceEmergency` | `select * from public.advance_emergency($1::uuid,$2::uuid,$3::public.emergency_status)` | `$1=emergencyId`, `$2=ambulanceId`, `$3=toStatus` |
| `advanceEmergency` readback | `select e.*,st_y(e.patient_location::extensions.geometry) as patient_lat,st_x(e.patient_location::extensions.geometry) as patient_lng from public.emergencies e where e.id=$1 and e.ambulance_id=$2 and e.status=$3::public.emergency_status` | `$1=emergencyId`, `$2=ambulanceId`, `$3=toStatus` |
| `cancelEmergency` | `select * from public.cancel_emergency($1::uuid,$2::text)` | `$1=emergencyId`, `$2=reason` |
| `cancelEmergency` readback | `select e.*,st_y(e.patient_location::extensions.geometry) as patient_lat,st_x(e.patient_location::extensions.geometry) as patient_lng from public.emergencies e where e.id=$1 and e.status='cancelled'` | `$1=emergencyId` |
| `releaseAmbulance` | `select public.release_ambulance($1::uuid) as released` | `$1=ambulanceId` |
| `addFeedback` | `insert into public.emergency_feedback (emergency_id,rating,comment) select $1,$2,$3 where exists (select 1 from public.emergencies where id=$1 and status='completed') on conflict (emergency_id) do nothing returning *` | `$1=emergencyId`, `$2=rating`, `$3=comment` |
| `addFeedback` event, only after returned feedback row | `insert into public.emergency_events (emergency_id,kind,actor_role) values ($1,'feedback','patient')` | `$1=emergencyId` |
| `setAmbulanceStatus` | `update public.ambulances set status=$2::public.ambulance_status,updated_at=now() where id=$1 returning *,st_y(location::extensions.geometry) as lat,st_x(location::extensions.geometry) as lng` | `$1=ambulanceId`, `$2=status` |
| `updateAmbulanceLocation` | `update public.ambulances set location=$2::extensions.geography,heading_degrees=$3,speed_kmph=$4,last_ping_at=now(),updated_at=now() where id=$1 returning *,st_y(location::extensions.geometry) as lat,st_x(location::extensions.geometry) as lng` | `$1=ambulanceId`, `$2=point(lat,lng)`, `$3=heading`, `$4=speedKmph` |
| `insertEvent` | `insert into public.emergency_events (emergency_id,kind,actor_role,data) values ($1,$2,$3,$4::jsonb) returning *` | `$1=emergencyId`, `$2=kind`, `$3=actorRole`, `$4=event data JSON` |

### Reads

| Adapter method | SQL statement | Parameters |
| --- | --- | --- |
| `getById` | `select e.*,st_y(e.patient_location::extensions.geometry) as patient_lat,st_x(e.patient_location::extensions.geometry) as patient_lng from public.emergencies e where e.id=$1` | `$1=id` |
| `getByTokenHash` | `select e.*,st_y(e.patient_location::extensions.geometry) as patient_lat,st_x(e.patient_location::extensions.geometry) as patient_lng from public.emergencies e where e.tracking_token_hash=$1 and e.tracking_expires_at>now()` | `$1=peppered token hash` |
| `activeForPatient` | `select e.*,st_y(e.patient_location::extensions.geometry) as patient_lat,st_x(e.patient_location::extensions.geometry) as patient_lng from public.emergencies e where e.patient_user_id=$1 and e.status not in ('completed','cancelled','no_match') order by e.created_at desc limit 1` | `$1=patientUserId` |
| `history` | `select e.*,st_y(e.patient_location::extensions.geometry) as patient_lat,st_x(e.patient_location::extensions.geometry) as patient_lng from public.emergencies e where e.patient_user_id=$1 order by e.created_at desc limit $2 offset $3` | `$1=patientUserId`, `$2=limit`, `$3=offset` |
| `listAdmin` | `select e.*,st_y(e.patient_location::extensions.geometry) as patient_lat,st_x(e.patient_location::extensions.geometry) as patient_lng from public.emergencies e where ($1::text is null or e.status::text=$1) order by e.created_at desc limit $2` | `$1=optional status`, `$2=limit` |
| `listAmbulances` | `select a.*,st_y(a.location::extensions.geometry) as lat,st_x(a.location::extensions.geometry) as lng from public.ambulances a order by a.registration_number` | no parameters |
| `ambulanceByDriver` | same ambulance select as above, `where a.driver_user_id=$1` | `$1=driverUserId` |
| `openOfferForAmbulance` | `select * from public.emergency_offers where ambulance_id=$1 and state='open' and expires_at>now() order by offered_at limit 1` | `$1=ambulanceId` |
| `offersForEmergency` | `select * from public.emergency_offers where emergency_id=$1 order by rank` | `$1=emergencyId` |
| `activeForAmbulance` | emergency select with `where e.ambulance_id=$1 and e.status in ('assigned','en_route','arrived','picked_up','at_hospital') order by e.created_at desc limit 1` | `$1=ambulanceId` |
| `timeline` | `select * from public.emergency_events where emergency_id=$1 order by created_at,id` | `$1=emergencyId` |
| `feedbackForEmergency` | `select * from public.emergency_feedback where emergency_id=$1` | `$1=emergencyId` |

Please check SQL casts, result columns, and null-return behavior against the dev migrations. This is a request for verification only; Codex did not run these statements.
