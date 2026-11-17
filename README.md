# Ashesi Graduation Tracker

> **Independent development prototype; not an official Ashesi University service.** No real student data or university systems are connected.

## Run it locally

```sh
cd web-app/frontend && npm install && npm run build
cd ../backend && npm install && STATIC_DIR=../frontend/out PORT=3000 npm run dev:demo
```

Open http://localhost:3000 and sign in as `20280001` (student) or `STF-1001` (admin), password `Synthetic-Demo-2028`. The demo API holds synthetic records in memory only.

The original fictional browser-only dashboard is served at `/demo/` ([source](web-app/frontend/public/demo/index.html)).

## Deploy

Live: https://ashesi-graduation-tracker.onrender.com


One Render web service from `render.yaml`. See the [Render deployment guide](docs/08-deployment/render-deployment-guide.md) and [ADR 0001](docs/04-architecture/adr/0001-single-origin-render-service.md).

## Links

- [Figma design](https://www.figma.com/design/oEZD3Gm9qLxUgRZh1hY3nL)
- [Handoff: where everything is](docs/09-handoff/final-handoff.md)
- [API reference (OpenAPI)](docs/05-api/openapi.yaml)
- [Build status](docs/00-governance/build-status.md)
- [Current implementation and limits](docs/01-implementation/iteration-2.md)
- [Master build prompt](docs/00-governance/master-build-prompt.md)
- [Workbook discrepancies](docs/00-governance/requirements-discrepancies.md)
- [Previous Ashesi Connect proposal, archived](docs/00-governance/previous-ashesi-connect-proposal.md)

## Tests

```sh
cd web-app/backend && npm test                      # API, auth, RBAC, audit engine
cd web-app/frontend && npm test && npm run test:e2e # client unit tests and browser journeys
```

The audit engine **intentionally does not declare any student eligible for graduation**: the full rulebook is not implemented.

## Status

| Workstream | State |
|---|---|
| Secure sign-in, sessions, RBAC and audit log (US-01) | Implemented and tested in CI |
| Student record and admin lookup screens | Implemented; synthetic data |
| Legacy browser-only demonstration | Available at `/demo/`, fictional data |
| Eligibility-engine unit tests | Running in CI |
| Figma low-fidelity screens | Available |
| High-fidelity clickable prototype | Incomplete |
| Official 2028 curriculum workbook | Received and reconciled; waiting on the Registry's course codes and answers to the discrepancies ([report](docs/02-requirements/degree-audit-2028/reconciliation.md)) |
| Render deployment | Live at https://ashesi-graduation-tracker.onrender.com with MongoDB Atlas; admin sign-in confirmed by the owner |
| Flutter app (Android, iOS) | Student and streamlined admin screens; tested in CI, which also builds the Android APK ([mobile-app](mobile-app/README.md)) |

**Needed from the Registry:** course codes, elective lists and C pass marks for the 2028 curriculum ([mapping template](docs/02-requirements/degree-audit-2028/curriculum-course-mapping.csv)), and answers to the [verified workbook discrepancies](docs/00-governance/requirements-discrepancies.md) in CS, CE, ME, MT and BE.
