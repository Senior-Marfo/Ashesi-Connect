# Implementation status — 2026-11-17

This branch is under active development and MUST NOT be deployed as a university production service.

## Implemented in branch
- MongoDB connection lifecycle, health endpoint and basic collections for students, enrollment attempts and programme requirements.
- US-01 authentication: single ID-based login with role resolved server-side, Argon2id hashing, 15-minute access tokens, rotating hashed refresh tokens in httpOnly cookies with reuse detection, lockout, login rate limiting, password change with policy, forced change after reset, admin-triggered reset.
- Permission-based RBAC (`requirePermission`) with automated RBAC and IDOR tests; see `docs/02-requirements/rbac-permission-matrix.md`.
- Admin activity and authentication audit log, readable at `GET /api/v1/admin/audit-log`.
- Student self-record, admin student search and admin student profile endpoints.
- App factory with injected repositories, so the HTTP layer is tested without a database.
- Static-export Next.js login interface.

## Blocking work
- Integration tests of the Mongoose repositories against a real MongoDB (CI job with `mongodb-memory-server`).
- Wiring the Next.js login, refresh and password-change screens to the API; emailing reset notices (needs SMTP).
- Verified workbook ingestion, curriculum versioning, elective and track rules, and all eligibility cases.
- Student and administrator screens, reports, imports, messaging, PDF exports, mobile app, CI and deployment.
- Registry confirmation of course-specific grade thresholds and discrepancies.

## Release policy
Never label this code production-ready until automated tests and security reviews pass, verified academic rules are loaded, and the full application is deployed and smoke-tested.
