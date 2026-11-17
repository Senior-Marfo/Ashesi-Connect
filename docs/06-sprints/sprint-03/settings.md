# Settings: standing thresholds, administrators, audit log — Sprint 03

`/admin/settings/` has three sections.

## Standing thresholds (`settings:manage`)

- Normal load, maximum load and the failed-course count for critical standing (`docs/03-design/severity-model.md`).
- **Validation:** loads run from 1 to 10 in 0.5 steps, the maximum load must be at least the normal load, and the failed-course count is 1–20.
- Saved in a single `settings` document. The student screens, admin lookup, register, reports and standing-based messages all use it straight away.
- Each change is logged as `ADMIN_SETTINGS_UPDATED`, recording the new and previous values.

## Administrators (`user:manage`)

- Lists every admin account. An account is flagged until its first sign-in, and while it's locked.
- **Create administrator** takes a staff ID (it must match `STAFF_ID_REGEX`). It returns a one-time temporary password (`Cache-Control: no-store`) that must be changed at first sign-in. Duplicate IDs are refused (`409`).
- Each creation is logged as `ADMIN_USER_CREATED`.

## Audit log (`audit-log:read`)

- The latest 100 entries, filterable by activity. Each entry shows the actor's staff or student ID rather than the internal account ID, plus the subject and details.
- Viewing the log is itself logged.

## Test infrastructure note

The Playwright suite signs in as the same demo admin more than ten times. Its demo server therefore raises `LOGIN_RATE_LIMIT_MAX` to 200. Production keeps 10 per IP address and ID per 15 minutes, which is how the suite exposed the problem.

## Evidence

- API tests: defaults; validation; saving with audit logging; a threshold change altering register standings; admin listing and creation with a forced password change; duplicate and invalid IDs; RBAC entries for every settings route.
- Contract tests for the settings document and listing accounts by role (MongoDB in CI).
- A Playwright journey changes and restores a threshold, creates an admin and filters the audit log.
