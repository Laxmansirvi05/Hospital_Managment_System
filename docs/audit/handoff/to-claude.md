# Codex to Claude hand-off

Date: 2026-11-04

## ID T2-test-prices

- **what:** Memory `listings.testPrices()` returns `[]`; Postgres selects active rows from `public.test_prices` and maps name, provider, price, centres, URL, checked date and total.
- **why:** The adapters cannot return matching populated shapes and data today. Do not manufacture real-looking prices. Decide whether a curated synthetic in-memory fixture is appropriate or keep memory explicitly empty and document the limitation.
- **file/line:** `server/db/memory.js:266`; `server/db/postgres.js:389-394`.
- **blocking?:** No production fix is blocked; populated adapter parity is unverified until there is an approved fixture or disposable Postgres test setup.

## ID T2-google-subject-conflict

- **what:** Memory user creation rejects duplicate `googleSub` values. Postgres `users.create()` uses `ON CONFLICT (email) DO NOTHING` only.
- **why:** A concurrent duplicate Google identity may raise a unique-constraint error in Postgres where memory returns null. Inspect the migration constraints and add a targeted adapter-level test or query change.
- **file/line:** `server/db/memory.js:57-60`; `server/db/postgres.js:121-124`.
- **blocking?:** No schema change is requested. Live database verification was prohibited in this pass.

## ID T3-pnpm-toolchain

- **what:** `pnpm audit` reports 15 development dependency advisories. Vitest 4.1.12 requires Vite 6+, but current lock resolves Vite 5.4.21. A package-level `pnpm.overrides` setting was ignored by pnpm 11 and was reverted.
- **why:** The Vitest bump cleared critical advisories but failed at startup with `ERR_PACKAGE_PATH_NOT_EXPORTED` for `vite/module-runner`. A working Vite 6 override belongs in pnpm workspace settings, outside the T3 file allowance in this pass.
- **file/line:** `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`.
- **blocking?:** Yes, owner approval is needed before expanding the dependency configuration change into `pnpm-workspace.yaml`.

## ID T8-handoff-status

- **what:** The current `to-codex.md` says `server/routes/assistant.js` and `tests/api.test.js` have uncommitted edits. They were clean at the point they were reviewed and were changed only for the T4 emergency fix and its test, then committed as `338148e`.
- **why:** The handoff is stale relative to the repository state and prompt exception for files that later became clean.
- **file/line:** `docs/audit/handoff/to-codex.md:8`.
- **blocking?:** No. Claude owns `to-codex.md`; please update it if the files remain clean in your state.
