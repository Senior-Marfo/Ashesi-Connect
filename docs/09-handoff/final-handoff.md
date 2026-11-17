# Final handoff

**Ashesi Graduation Tracker** shows students whether they are on track to graduate and what remains, and gives the Registry tools to find, monitor, report on and message students. It is an independent prototype, not an official Ashesi University service, and its results are advisory.

## What exists

| Part | State |
|---|---|
| Web app and API | Live at https://ashesi-graduation-tracker.onrender.com (Render, MongoDB Atlas), deployed from `main` |
| Mobile app | Flutter, Android and iOS. CI builds an installable Android APK |
| Data | Synthetic demonstration cohort plus real accounts. No real student records until the curriculum is approved |
| Tests | Backend, MongoDB contract, web unit, browser journeys with accessibility checks, and mobile tests, all in CI |

## Where to find things

| Need | Document |
|---|---|
| Run it locally | [`README.md`](../../README.md), [`mobile-app/README.md`](../../mobile-app/README.md) |
| How it is built | [System architecture](../04-architecture/system-architecture.md), [data model](../04-architecture/data-model.md), [security and privacy](../04-architecture/security-and-privacy.md) |
| API | [OpenAPI spec](../05-api/openapi.yaml), [error catalogue](../05-api/error-catalogue.md), [permission matrix](../02-requirements/rbac-permission-matrix.md) |
| Rules | [Severity model](../03-design/severity-model.md), [assumptions](../00-governance/assumptions-log.md), [requirements discrepancies](../00-governance/requirements-discrepancies.md) |
| Operate it | [Environment variables](../08-deployment/environment-variables.md), [runbook](../08-deployment/runbook.md), [rollback plan](../08-deployment/rollback-plan.md), [Render guide](../08-deployment/render-deployment-guide.md), [mobile release guide](../08-deployment/mobile-release-guide.md) |
| Use it | [Student guide](student-user-guide.md), [administrator guide](admin-user-guide.md) |
| Check a release | [Test strategy](../07-testing/test-strategy.md), [UAT script](../07-testing/uat-script.md) |
| What's left | [Known issues](known-issues.md), [roadmap](future-roadmap.md), [user stories](../02-requirements/user-stories.md), [build status](../00-governance/build-status.md) |

## Needed from the Registry or owner

1. `Degree_Audit_2028.xlsx`, and confirmation of the discrepancies and of which courses need a C.
2. A decision on the elective pass-mark default.
3. SMTP settings; a Firebase project for push; store signing keys and developer accounts.
4. Approval to load real student data, with a retention policy.
