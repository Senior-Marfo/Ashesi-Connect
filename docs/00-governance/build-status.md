# Implementation status — 2026-11-17

Deployed: https://ashesi-graduation-tracker.onrender.com, one Render web service from `Senior-Marfo/Ashesi-Connect` `main` with a MongoDB Atlas database. It serves the API and the web client from one origin; the legacy fictional demo stays at `/demo/`. Smoke-test record: `docs/07-testing/test-reports/2026-11-17-post-deploy-smoke.md`.

This branch is under active development and MUST NOT be deployed as a university production service.

## Implemented in branch
- MongoDB connection lifecycle, health endpoint and basic collections for students, enrollment attempts and programme requirements.
- US-01 authentication: single ID-based login with role resolved server-side, Argon2id hashing, 15-minute access tokens, rotating hashed refresh tokens in httpOnly cookies with reuse detection, lockout, login rate limiting, password change with policy, forced change after reset, admin-triggered reset.
- Permission-based RBAC (`requirePermission`) with automated RBAC and IDOR tests; see `docs/02-requirements/rbac-permission-matrix.md`.
- Admin activity and authentication audit log, readable at `GET /api/v1/admin/audit-log`.
- Student self-record, admin student search and admin student profile endpoints.
- US-06 student lookup: search by ID prefix or name, with close matches for a single ID typo or small name typos; recently opened records; staff-only notes; the student's message history with read times; and an audit-logged print / save-as-PDF of the audit.
- App factory with injected repositories, so the HTTP layer is tested without a database.
- Next.js static-export web client wired to the API: sign-in, silent token refresh and session restore, sign-out, forced and voluntary password change, a student record screen and an admin student lookup. Pages are role-guarded on the client; the API enforces permissions.
- Controlled curriculum import, validation and review workflow from `feat/2028-workbook-safe-import`, merged 2026-11-17. Students see a provisional progress preview, and admins see a read-only curriculum catalogue. Review writes stay off unless `ENABLE_CURRICULUM_REVIEW=yes` is set and the reviewer is on the allowlist.
- US-02 to US-05 student screens: status card with standing and progress ring, requirement tree, remaining-work plan, and courses marked Passed / Below pass mark. They use a Registry-reviewed curriculum for real students and illustrative synthetic rules for synthetic students only.
- Settings: adjustable standing thresholds used by every assessment, admin account creation with temporary passwords, and an audit-log viewer.
- Course pass marks: admins set D+ or C per course, citing a source. Every audit, the register, reports and course summaries use them, and changes are audit-logged. No course is set to C until the Registry confirms one.
- Record imports: CSV import of students and course records with a row-level preview, all-or-nothing apply, batch history and exact undo. New student accounts stay locked until an admin issues a temporary password.
- US-11 and US-12 messaging: admins compose messages (with templates) for all students, a programme, a year group, a standing or specific IDs, with a live recipient count, audit logging and read receipts. Students have an inbox with an unread badge and mark-as-read.
- US-08 to US-10 reports: standing distribution, graduation outcomes by year group with reasons for not completing (year-on-year comparison), progress of current year groups, programme comparison, course pass rates, retakes and grade distribution. Includes a print stylesheet and CSV per section.
- US-07 student register: filterable, sortable, paginated table with CSV export, built from course records with the provisional D+ pass mark. Severity stays undetermined until a reviewed curriculum exists.
- Synthetic student records: a deterministic generator of 600 fictional students (all programmes, 2025–2030), loaded or removed by a manual GitHub Actions workflow. It refuses databases that hold real students, and the UI labels synthetic records.
- Repository contract tests shared by the in-memory and MongoDB implementations; the MongoDB run happens in the CI `backend-mongodb` job.
- In-memory demo API with synthetic accounts (`npm run dev:demo` in `web-app/backend`) and Playwright end-to-end journeys at desktop and phone sizes.

## Blocking work
- Confirm the first green run of the CI `backend-mongodb` job; it has not run in the development container, which cannot download MongoDB.
- Emailing reset notices and message copies (needs SMTP).
- Signed-in part of the post-deploy smoke test: anonymous checks passed on 2026-11-17. The signed-in checks need the `SMOKE_*` repository secrets and a run of the manual **Post-deploy smoke test** workflow.
- Verified workbook ingestion, curriculum versioning, elective and track rules, and all eligibility cases.
- Loading the official 2028 curriculum (needs `Degree_Audit_2028.xlsx` and Registry review) so real students get a standing. Then: imports, messaging, PDF exports, mobile app and deployment.
- Registry confirmation of which courses need a C. Once confirmed, enter them under **Settings → Course pass marks**. Workbook discrepancies are still open.

## Release policy
Never label this code production-ready until automated tests and security reviews pass, verified academic rules are loaded, and the full application is deployed and smoke-tested.
