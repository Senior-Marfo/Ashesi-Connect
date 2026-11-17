# Implementation status — 2026-11-17

Deployment target: one Render web service from `Senior-Marfo/Ashesi-Connect` `main`, serving the API and the web client from one origin. The legacy fictional demo stays at `/demo/`.

This branch is under active development and MUST NOT be deployed as a university production service.

## Implemented in branch
- MongoDB connection lifecycle, health endpoint and basic collections for students, enrollment attempts and programme requirements.
- US-01 authentication: single ID-based login with role resolved server-side, Argon2id hashing, 15-minute access tokens, rotating hashed refresh tokens in httpOnly cookies with reuse detection, lockout, login rate limiting, password change with policy, forced change after reset, admin-triggered reset.
- Permission-based RBAC (`requirePermission`) with automated RBAC and IDOR tests; see `docs/02-requirements/rbac-permission-matrix.md`.
- Admin activity and authentication audit log, readable at `GET /api/v1/admin/audit-log`.
- Student self-record, admin student search and admin student profile endpoints.
- App factory with injected repositories, so the HTTP layer is tested without a database.
- Next.js static-export web client wired to the API: sign-in, silent token refresh and session restore, sign-out, forced and voluntary password change, a student record screen and an admin student lookup. Pages are role-guarded on the client; the API enforces permissions.
- Repository contract tests shared by the in-memory and MongoDB implementations; the MongoDB run happens in the CI `backend-mongodb` job.
- In-memory demo API with synthetic accounts (`npm run dev:demo` in `web-app/backend`) and Playwright end-to-end journeys at desktop and phone sizes.

## Blocking work
- Confirm the first green run of the CI `backend-mongodb` job; it has not run in the development container, which cannot download MongoDB.
- Emailing reset notices (needs SMTP). Admin UI for password resets and the audit log.
- First live deploy: `render.yaml` is ready as a one-service Blueprint (`docs/08-deployment/render-deployment-guide.md`). It needs a MongoDB Atlas connection string, and the post-deploy smoke test must be recorded.
- Verified workbook ingestion, curriculum versioning, elective and track rules, and all eligibility cases.
- Eligibility status, requirements and remaining-work screens (US-02 to US-04), severity register, reports, imports, messaging, PDF exports, mobile app and deployment.
- Registry confirmation of course-specific grade thresholds and discrepancies.

## Release policy
Never label this code production-ready until automated tests and security reviews pass, verified academic rules are loaded, and the full application is deployed and smoke-tested.
