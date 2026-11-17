# Implementation status — 2026-11-17

Deployed: https://ashesi-graduation-tracker.onrender.com, one Render web service from `Senior-Marfo/Ashesi-Connect` `main` with a MongoDB Atlas database. It serves the API and the web client from one origin; the legacy fictional demo stays at `/demo/`. The owner confirmed admin sign-in (`STF-0001`) on the live site on 2026-11-17.

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
- Manual records: admins add a single student (with a locked account, as with imports), edit their details, and add, correct or remove course records with their full attempt history. Synthetic records are read-only. Every change is audit-logged with before and after values.
- Scheduled messages: admins pick a delivery time up to 180 days ahead and can cancel before it. Recipients are fixed when the message is created, and inboxes show it only once delivered.
- Register bulk selection: select students across pages and filters, then message them.
- Reports: credits still to complete and projected graduation for current year groups, plus messaging reach (delivered, deliveries, read rate).
- Student profile page with programme, year group, track and expected graduation, linking to password change (admins reach it from Settings).
- Flutter mobile app (`mobile-app/`): sign-in with role routing and forced password change; student status with progress ring, requirements, path to graduation, courses, inbox with unread badge, and profile; admin search with close matches and a student record with staff notes. Offline viewing of the last status, secure token storage, and light and dark themes from the web tokens. CI analyzes, tests and builds the Android APK. Optional biometric unlock. Push notifications and store signing are not done yet.
- Automated accessibility checks: axe-core runs on every main student and admin screen at desktop and phone sizes, and serious or critical WCAG 2.2 AA findings fail CI. Four findings were fixed: two contrast, one keyboard access, one target size.
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
- Verified workbook ingestion, curriculum versioning, elective and track rules, and all eligibility cases.
- Loading the official 2028 curriculum so real students get a standing. The workbook was received and reconciled on 2026-11-17 (`02-requirements/degree-audit-2028/`). Still needed: the Registry's course codes in the mapping template, answers to the verified discrepancies, then draft import and review.
- Registry confirmation of which courses need a C. Once confirmed, enter them under **Settings → Course pass marks**. Workbook discrepancies are still open.

## Release policy
Never label this code production-ready until automated tests and security reviews pass, verified academic rules are loaded, and the full application is deployed and smoke-tested.
