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
- W10 remains a partial manual audit because the saved public sweep redirects protected routes to sign-in and G2 is blank. No axe dependency was added.
- W11 detail pages show a no-phone message and directions, but result cards do not expose phone availability. Owner should confirm the desired list-card interaction before a UI change.
- W9 assistant focus trap remains missing. Robot source was in the owner's recent UI lane; no edits were made to it.
- W19 stopped before starting a local cluster because the installed PostgreSQL extension directory lacks PostGIS. No migration or database was used.
- Owner approvals G1, G2 and G3 are still blank. No owner decision or production action was inferred.
- Final report: `docs/audit/CODEX_REMAINING_2026-11-04.md`.
