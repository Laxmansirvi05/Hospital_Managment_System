# CareRoute

CareRoute is a healthcare discovery and assistance platform for Hyderabad. It has three parts:

1. **Healthcare discovery.** Search hospitals, doctors, medicines and their listed prices, pharmacies and diagnostic centres. Each result shows public details and links to the provider, who handles any booking, order or payment.
2. **AI healthcare assistant.** Explains a medical report in plain language and helps people find relevant care from a description in ordinary words. It never diagnoses or prescribes.
3. **Emergency ambulance system.** A patient or bystander raises an SOS. The nearest suitable ambulance is offered the job, ranked by road ETA and vehicle type, and the driver accepts or rejects it. The patient and family follow it live.

Roles are patient, driver and platform admin. There is no hospital portal.

## Status

Documentation phase. No application code yet. The documents in `docs/` are drafts for the owner's approval. Items that are decided are marked LOCKED in [`docs/00-decisions.md`](docs/00-decisions.md). Items that still need an answer are marked OPEN there.

## Stack

HTML, CSS and JavaScript as the foundation, with a Node.js API, on Vercel. UI frameworks and TypeScript only when necessary and approved. Listing and medicine data from online platforms such as Apollo, MedPlus and Tata 1mg. Supabase for PostgreSQL with PostGIS, file Storage and Realtime. MapLibre with MapTiler tiles for maps. Mapbox for road ETA. Gemini, then Groq, then OpenRouter for the symptom assistant. Twilio trial for SMS. Web only, responsive, English only.

## Documents

Start with [`docs/README.md`](docs/README.md) for the full index.

| Need | Read |
| --- | --- |
| What is decided and what is open | [`docs/00-decisions.md`](docs/00-decisions.md) |
| What we are building | [`docs/01-prd.md`](docs/01-prd.md) |
| How it is built | [`docs/02-trd.md`](docs/02-trd.md), [`docs/03-architecture.md`](docs/03-architecture.md) |
| API contract | [`docs/05-api-spec.md`](docs/05-api-spec.md), [`postman/`](postman) |
| Security | [`docs/09-security.md`](docs/09-security.md), [`SECURITY.md`](SECURITY.md) |
| Design | [`docs/11-design-system.md`](docs/11-design-system.md) |
| How we work | [`docs/15-workflow.md`](docs/15-workflow.md), [`CLAUDE.md`](CLAUDE.md) |

## Contract

The API contract is [`postman/ambulance-platform.postman_collection.json`](postman/ambulance-platform.postman_collection.json) with its environment file. It runs in folder order 0 to 7 and checks its own responses.

## Demo data

The demo uses synthetic data only. Do not enter real patient information anywhere in this project.
