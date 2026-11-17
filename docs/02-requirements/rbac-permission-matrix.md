# RBAC permission matrix

Permissions are granted per role in `web-app/backend/src/auth/permissions.ts` and enforced by the `requirePermission` middleware. The role always comes from the stored account record that matched the submitted ID, never from the client.

| Permission | STUDENT | ADMIN | Used by |
|---|:-:|:-:|---|
| `student:read:own` | ✓ | | `GET /api/v1/students/me`, `/students/me/eligibility`, `/students/me/academic-preview`, `/students/me/curriculum`, `/students/me/audit-readiness` |
| `student:read:any` | | ✓ | `GET /api/v1/admin/students`, `GET /api/v1/admin/students/:studentId`, `GET /api/v1/admin/students/:studentId/eligibility`, `GET /api/v1/admin/students/:studentId/notes`, `GET /api/v1/admin/students/:studentId/messages`, `POST /api/v1/admin/students/:studentId/audit-export`, `GET /api/v1/admin/register`, `GET /api/v1/admin/register.csv` |
| `student:note:write` | | ✓ | `POST /api/v1/admin/students/:studentId/notes` |
| `user:reset-password` | | ✓ | `POST /api/v1/admin/users/reset-password` |
| `audit-log:read` | | ✓ | `GET /api/v1/admin/audit-log` |
| `message:send` | | ✓ | `/api/v1/admin/messages` (compose, preview, templates, sent list with read receipts) |
| `message:read:own` | ✓ | | `/api/v1/students/me/messages` (inbox, unread count, mark read) |
| `settings:manage` | | ✓ | `GET /api/v1/admin/settings`, `PUT /api/v1/admin/settings/standing`, `GET /api/v1/admin/settings/pass-marks`, `PUT`/`DELETE /api/v1/admin/settings/pass-marks/:courseCode` |
| `user:manage` | | ✓ | `GET`/`POST /api/v1/admin/settings/admins` |
| `records:edit` | | ✓ | `POST /api/v1/admin/records/students`, `PATCH /api/v1/admin/records/students/:studentId`, `PUT`/`DELETE /api/v1/admin/records/students/:studentId/courses/:courseCode` |
| `records:import` | | ✓ | `/api/v1/admin/imports` (history, preview, apply, undo) |
| `report:read` | | ✓ | `GET /api/v1/admin/reports`, `GET /api/v1/admin/reports/{cohorts,programmes,courses}.csv` |
| `curriculum:read` | | ✓ | `GET /api/v1/admin/curricula`, `GET /api/v1/admin/curricula/detail`, `GET /api/v1/admin/curricula/review-access` |
| `curriculum:review` | | ✓ | `POST /api/v1/admin/curricula/review`, which also requires `ENABLE_CURRICULUM_REVIEW=yes` and the admin's staff ID (or account ID) in `CURRICULUM_REVIEWER_IDS` |

Adding `SUPER_ADMIN` or `ADVISOR` means adding the role to `ROLES` and giving it a permission set. Routes and the database schema stay as they are.

## Cross-cutting rules

- **Record isolation:** every `/students/me…` route reads the student ID from the verified access token only. There is no route that takes a student ID from a student caller.
- **Temporary passwords:** an access token issued for an account with `forcePasswordChange` carries `passwordChangeRequired: true`. Every student and admin route rejects it with `403 PASSWORD_CHANGE_REQUIRED`. Only `POST /auth/password` and `POST /auth/logout` stay usable.
- **Audit trail:** admin searches, profile views, staff notes, audit exports, register views and exports, password resets and audit-log reads are written to `auditLogs` with the actor, subject, request ID and IP address. Sign-ins, failures, lockouts, logouts, password changes and refresh-token reuse are logged too.

## Automated proof

`web-app/backend/src/http/authorization.http.test.ts` checks:

- a student token gets `403` on every admin route;
- anonymous requests get `401`;
- forged tokens (wrong secret, `alg: none`) get `401`;
- an admin token cannot use the student self-service route;
- a student cannot reach another student's record through a query string, a path or path traversal.
