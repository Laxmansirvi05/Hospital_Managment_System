# Contract changes between the admin side (Claude) and the patient side (Codex)

Append only. One entry per change to a shared route, table, response shape or store method. Newest last.

## 2026-11-06 — Sync registered admin routes into the shared API contract

Added 15 already-registered admin method/path pairs to `docs/05-api-spec.md` and `postman/ambulance-platform.postman_collection.json` so the shared contract matches `server/router.js` (104 route entries total). This is documentation and collection coverage only; no admin route, service, or test implementation changed. P-18/P-22 admin work was approved by D-83. The driver reject route remains marked PROPOSED under P-20 and is not treated as approved.

Added paths: `GET /admin/overview`, `GET /admin/users`, `POST /admin/users/:id/disable`, `POST /admin/users/:id/enable`, `GET /admin/listings`, `GET /admin/hospital-choices`, `GET /admin/listings/:kind/:id`, `POST /admin/listings/:kind`, `PATCH /admin/listings/:kind/:id`, `POST /admin/listings/:kind/:id/hide`, `POST /admin/listings/:kind/:id/unhide`, `GET /admin/reviews`, `POST /admin/reviews/:id/restore`, `DELETE /admin/reviews/:id`, `GET /admin/audit`.

## 2026-11-06, Claude (admin side)

- **Added routes** (all role `admin`, all under `/api/v1`): `GET /admin/overview`, `GET /admin/users`, `POST /admin/users/:id/disable`, `POST /admin/users/:id/enable`, `GET /admin/listings`, `GET /admin/hospital-choices`, `GET|PATCH /admin/listings/:kind/:id`, `POST /admin/listings/:kind`, `POST /admin/listings/:kind/:id/hide`, `POST /admin/listings/:kind/:id/unhide`, `GET /admin/reviews`, `POST /admin/reviews/:id/restore`, `DELETE /admin/reviews/:id`, `GET /admin/audit`. Code: `server/routes/admin.js`. Contract rows are in `scripts/generate-api-contract.js` (`adminContracts`), `docs/05-api-spec.md` and the Postman collection.
- **Added table:** `public.admin_audit_log` (migration `supabase/migrations/20261106000100_admin_audit.sql`, not applied to any real project). Append only for `careroute_api`.
- **Added store methods:** `store.admin.*` in `server/db/admin-memory.js` and `server/db/admin-postgres.js`, hooked into `server/db/memory.js` and `server/db/postgres.js` with one line each.
- **Changed `server/db/memory.js` (shared file, small):** pharmacies and diagnostic centres are now per-store copies (`pharmacies`, `diagnostics`) instead of the seed constants, so an admin hide or create affects only that store. Hidden listings move to `hiddenListings`; `hospitalOf` also looks there so a hidden hospital still names its doctors' workplace, the way the Postgres join does. No public read behaviour changed for visible listings.
- **Behaviour patients can see:** a hidden listing (active = false) disappears from patient search and detail pages; an admin-created listing appears in them with source "CareRoute admin"; a review hidden by reports is shown again after an admin keeps it, and its reports are cleared so only new reports can hide it again; a disabled account loses its sessions and cannot sign in.
- **Asks of the patient side:** please do not rename `users.disabled_at`, `reviews.status`, `review_reports`, or the `active` column on listings; the admin side depends on them.
