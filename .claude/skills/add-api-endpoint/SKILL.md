---
name: add-api-endpoint
description: Use when adding or changing a CareRoute REST endpoint under /api/v1. Covers contract check, Zod schemas, role and ownership checks, tests, and doc updates in the required order.
---

# Add or change an API endpoint

## Before writing code

1. Find the endpoint in `postman/ambulance-platform.postman_collection.json` and `docs/05-api-spec.md`. If it is not there, it is a new endpoint: stop and get the owner's approval first. New endpoints are recorded as PROPOSED in the spec.
2. Read the blocking open questions for this area in `docs/00-decisions.md`. If one blocks the work, ask the owner. Do not assume an answer.
3. Read `docs/09-security.md` sections 5 and 12.

## Steps

1. **Schemas.** Write the request Zod schema next to the handler in `server/routes`, and describe response shapes with JSDoc `@typedef`. Field names are camelCase and match the collection exactly. Lists are returned as an object with a named array.
2. **Failing tests first.** Write tests for: no token (401), wrong role (403), right role but not the owner, invalid input (422 with the failing field named), the success path with the status code the collection expects, and any state rule that applies.
3. **Route handler.** Add it in `server/routes` and register it in `server/router.js`, static paths before `:id` paths. Do not add a new file under `api/`. In order: authenticate, check role, parse input, check ownership, run the query, build the response from explicit fields.
4. **Database.** Queries go in `server/db`, parameterized. A schema change goes through the `db-migration` skill.
5. **External calls** go through an adapter in `server/adapters` with a timeout, a typed error and a fallback.
6. **Logging.** Use the redacting logger. Do not log bodies, tokens, phone numbers, locations or medical data.
7. **Contract run.** Run the Postman collection against a seeded local app on port 4000. Do not edit the collection to make it pass.
8. **Docs.** Update `docs/05-api-spec.md` and any lifecycle, data model or security doc the change touches. Add a line to `CHANGELOG.md`.
9. **Reviews.** Run the contract agent. Run the security agent if the endpoint touches auth, data, tokens, uploads, SMS or third parties.

## Rules

- A route is not finished without tests for 401, 403 and the happy path.
- Never return a database row as is.
- The public tracking response is its own type and must never carry medical, name or phone data.
- Do not use the em dash character in code comments, messages or docs.
- Report honestly what was tested and what was not.
