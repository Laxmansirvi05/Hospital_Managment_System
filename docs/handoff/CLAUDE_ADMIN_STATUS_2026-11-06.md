# Admin side status, 2026-11-06

Owner: Claude. Scope and privacy rules: D-83. Committed on `main` on 2026-11-06; not pushed.

## Done and checked

| Area | What exists | How it was checked |
|---|---|---|
| Access | Admin-only routes (401 anonymous, 403 patient and driver); `#/` shell refuses non-admin accounts | 48 route tests, e2e gate test |
| People | List, search, filter by role and status; disable and enable; disabling ends sessions; sign-in refused while disabled; cannot disable yourself or the last active admin | route tests, e2e |
| Listings | List, search, filter; add, edit, hide and show for hospital, doctor, pharmacy and diagnostic centre; doctors choose a listed hospital or their own clinic; Hyderabad bounds, https-only booking links, no future check dates | route tests, e2e, screenshots at desktop and phone width |
| Hiding | Hidden listings leave patient search, maps and the assistant; doctors keep their hospital name | route tests, e2e (patient search before and after) |
| Reviews | Reported, hidden and combined views; keep (clears reports) or delete; author never shown | route tests, e2e |
| Audit | Append-only log of every admin write, written in the same transaction; screen with filter | route and SQL-shape tests, e2e |
| Emergencies | Synthetic ambulance console moved into the admin shell (polling every 5 s, map, timeline, hourly table) | opened in a browser, no new tests |
| Phone layout | Tables become cards, tab bar shows all six sections, no sideways scroll | e2e at ## Added on 2026-11-06 (owner: complete the pending admin work)

| Area | What exists | How it was checked |
|---|---|---|
| Real database | `20261106000100_admin_audit.sql` applied to careroute-dev. All admin store methods run against it: accounts, all four listing kinds including clinic and hospital switches, hide and show, three reports hiding a review, keep, delete, disable, audit rows, data quality. Synthetic rows were then deleted. | Direct store calls as the `careroute_api` role against careroute-dev; 47 steps with no failure, then the review, disable and account script flow |
| Account script | `scripts/create-privileged-account.js` (D-21): hidden password prompt, 12 character minimum, refuses an existing email instead of promoting it, writes an audit row | `tests/privileged-account.test.js`, and one real run on careroute-dev |
| Sign-in | Admin and driver accounts land on their own workspace, not the patient dashboard; the shell has a way back and no empty headings | e2e |
| Analytics (F-34, P-18) | Total requests, overall average time to assign and to arrive | route test, e2e |
| Nearby ambulances (F-17) | `GET /admin/ambulances?type&lat&lng&radiusKm`: available crews in range, nearest first; a form on the emergencies screen | route tests, e2e |
| Data quality (P-31) | Read only: per kind, checked long ago, no phone, no source link; possible duplicates | route tests, e2e, real SQL on careroute-dev (47 duplicate groups, many listings with no phone) |

## Not verified

- `20261104000100_emergency.sql`, `20261104000200_demo_ambulances.sql` and `20261106000100_admin_audit.sql` are not on careroute-prod. Production needs the owner's written approval.
- The browser journeys ran on the in-memory store. The real database was exercised through the store, not through the browser.
- The last active admin rule has only run on the in-memory store and the recording fake: careroute-dev has no standing admin to test it safely.
- Screen-reader walkthrough was not done beyond labelled controls, native dialogs and focus moving to the page heading and first invalid field.
- No account has the admin role on either real database yet. The owner creates theirs with the script.

## Not built, needs an owner decision

- Driver and ambulance management beyond viewing (creating crews, assigning drivers). Not in D-83.
- Listing photos, and bulk import or export. Not in D-83.
- Source refresh from the admin screen. The collectors still run by command (Q-28 is open).
- Review report details (who reported is intentionally not available).

ilable).

## For Codex

- Do not rename `users.disabled_at`, `reviews.status`, `review_reports` or the `active` columns; the admin side depends on them (see `CONTRACT_CHANGES.md`).
- The admin shell has its own helpers in `public/admin/lib.js`; it only imports `h.js`, `api.js` and `real-map.js` from shared code.
- The old `public/js/pages/admin.js` was retired to `_to_delete/retired/`.
