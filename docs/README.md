# Documentation index

Read [`00-decisions.md`](00-decisions.md) first. It says what is decided, what is proposed and what is open, and it wins over every other file.

| File | Contents |
| --- | --- |
| [`00-decisions.md`](00-decisions.md) | Decision log, changes forced by decisions, proposed items, open questions |
| [`01-prd.md`](01-prd.md) | Product requirements: purpose, users, features with acceptance criteria, risks |
| [`02-trd.md`](02-trd.md) | Technical requirements: stack, conventions, standards, failure behavior |
| [`03-architecture.md`](03-architecture.md) | System diagram, main flow, live tracking, the Care Thread |
| [`04-data-model.md`](04-data-model.md) | Tables, enums, indexes, database functions |
| [`05-api-spec.md`](05-api-spec.md) | Every endpoint from the Postman collection, plus proposed discovery, assistant, admin and report endpoints |
| [`06-emergency-lifecycle.md`](06-emergency-lifecycle.md) | States, allowed moves, offers and the 30 second expiry |
| [`07-ai-triage.md`](07-ai-triage.md) | AI assistant: safety limits, triage rules and model chain, discovery assistant, report explanation |
| [`08-medical-reports.md`](08-medical-reports.md) | Upload, explanation, sharing, audit, deletion |
| [`09-security.md`](09-security.md) | Threats, key handling, authorization, headers, pre-merge checklist |
| [`10-privacy-and-data.md`](10-privacy-and-data.md) | Data inventory, consent, third parties, user rights, retention |
| [`11-design-system.md`](11-design-system.md) | Apple-based design direction, tokens, components, banned patterns |
| [`12-ux-and-content.md`](12-ux-and-content.md) | Screens by role including discovery and admin, flows, status copy, writing rules |
| [`13-accessibility.md`](13-accessibility.md) | WCAG 2.2 AA plus stricter targets, testing |
| [`14-testing-strategy.md`](14-testing-strategy.md) | Test layers, required tests, rules for tests |
| [`15-workflow.md`](15-workflow.md) | Work packages, definitions of ready and done, review gates, rules for AI agents |
| [`16-deployment-and-environments.md`](16-deployment-and-environments.md) | Environments, variables, limits, release steps |
| [`17-observability-and-runbook.md`](17-observability-and-runbook.md) | What we watch, runbook, incident template |
| [`18-glossary.md`](18-glossary.md) | Terms |
| [`19-setup-checklist.md`](19-setup-checklist.md) | Accounts and keys to create before building, how keys are stored, current status |

Outside `docs/`: [`../CLAUDE.md`](../CLAUDE.md) (rules for AI sessions), [`../SECURITY.md`](../SECURITY.md), [`../CHANGELOG.md`](../CHANGELOG.md), [`../postman/`](../postman) (API contract), [`../.claude/agents`](../.claude/agents) and [`../.claude/skills`](../.claude/skills).

## Status labels

LOCKED (decided by the owner), COLLECTION (from the Postman file), PROPOSED (suggested, needs approval), OPEN (unknown, needs an answer).
