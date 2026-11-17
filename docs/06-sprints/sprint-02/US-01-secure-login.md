# US-01: Secure login by Student or Staff ID — Sprint 02

## Implemented

- **One login for both roles.** Students and staff use the same form. The backend checks the ID against `STUDENT_ID_REGEX` / `STAFF_ID_REGEX`, finds the account and takes the role from the stored record. Unknown IDs, malformed IDs, wrong passwords and locked accounts all return the same `401 INVALID_CREDENTIALS`, and unknown IDs still run a password verification so response timing doesn't reveal which IDs exist.
- **Short-lived access tokens.** HS256 JWTs with a 15-minute default lifetime (`ACCESS_TOKEN_TTL`), pinned issuer, audience and algorithm.
- **Rotating refresh tokens.** Each token is an opaque 256-bit random value in an `httpOnly` cookie scoped to `/api/v1/auth`. Only its SHA-256 hash is stored. Every refresh revokes the presented token and issues a new one in the same family. If a token that was already rotated is presented again, the whole family is revoked and the user has to sign in again. A conditional update stops two concurrent refreshes from both succeeding. MongoDB's TTL index removes expired records.
- **Cookie policy.** `SameSite=Strict` everywhere, plus `Secure` in production. The API serves the web client from the same origin (ADR 0001), so the cookie is first-party. `/auth/refresh` and `/auth/logout` require an `X-Requested-With` header, which a cross-site page cannot send without a CORS preflight that the allow-list rejects.
- **Lockout and rate limiting.** After `LOCKOUT_THRESHOLD` consecutive failures (default 5) the account is locked for `LOCKOUT_MINUTES` (default 15). Separately, login attempts are limited per IP address and ID pair (`LOGIN_RATE_LIMIT_MAX` per `LOGIN_RATE_LIMIT_WINDOW_SECONDS`, IPv6-safe keying).
- **Passwords.** Hashed with Argon2id. The policy requires at least 12 characters, at least three character classes and no copy of the user's ID. Changing a password revokes every session, and `forcePasswordChange` blocks all other routes until a temporary password has been replaced.
- **Admin-triggered reset.** `POST /api/v1/admin/users/reset-password` returns a one-time temporary password (`Cache-Control: no-store`), revokes the user's sessions, clears any lockout and records who did it.
- **Admin activity log.** See `docs/02-requirements/rbac-permission-matrix.md`.

## Structure

`src/http/app.ts` builds the Express app from injected repositories, so the HTTP layer can be tested without a database. `src/server.ts` only connects MongoDB and listens. The Mongoose implementations live in `src/repositories/mongo.ts`. The in-memory implementations in `src/testing/` are used by the tests only.

## Acceptance evidence

`npm test` in `web-app/backend` runs 59 tests, including 39 new HTTP and service tests for login, lockout and unlock, rate limiting, cookie flags, rotation and reuse detection, expiry, logout, password policy, forced change, admin reset, RBAC, IDOR and audit logging.

## Not done in this story

- The API has not been run against a live MongoDB from the development container, because the sandbox blocks MongoDB binary downloads. `src/repositories/mongo.ts` is type-checked but has no integration test yet. Add a `mongodb-memory-server` job in CI, where the download is allowed.
- The Next.js login page does not call these endpoints yet.
- The reset flow returns the temporary password to the admin. Email delivery waits on SMTP credentials.

## Merge of `feat/2028-workbook-safe-import`

Merged into `main` on 2026-11-17:

- The curriculum routes use the new middleware. Admin routes need `curriculum:read` or `curriculum:review`. Student routes need `student:read:own` and read the student ID from the access token only.
- The staging seed now creates `20289001` (student) and `STF-9001` (admin), which match the default ID formats.

## Web client (second increment)

- **API client** (`web-app/frontend/lib/api.ts`). Keeps the access token in memory only and never in browser storage. Every request sends credentials and the `X-Requested-With` header. A `401` triggers one refresh and a retry. Concurrent requests share a single refresh, because each refresh token works only once.
- **Session** (`lib/session.tsx`). On page load the client tries a refresh, so a reload keeps the user signed in without storing a token. `useRequireRole` sends anonymous users to sign-in, accounts with a temporary password to `/change-password/`, and users of the other role to their own home page. These redirects are for convenience; the API enforces access.
- **Screens.** Sign-in, change password, student record and admin student lookup. Each has loading, empty and error states. The figures shown are recorded credits only, labelled as not a graduation decision until Registry rules are loaded.
- **Accessibility.** Fields have real labels, hints are linked with `aria-describedby`, focus is visible, reduced motion is respected and dark mode is supported. On phones the course table moves the semester under the course code.

### Running locally

```bash
cd web-app/backend && npm run dev:demo      # synthetic in-memory API on :4000
cd web-app/frontend && npm run build && node e2e/static-server.mjs out   # :3000
```

Demo accounts: `20280001`, `20280002`, `20280003` (has a temporary password) and `STF-1001`, all with password `Synthetic-Demo-2028`. The demo server refuses to start with `NODE_ENV=production`.

### Evidence

- Frontend: 12 unit tests (API client refresh behaviour, login form errors, course table).
- Playwright: 9 end-to-end runs at desktop and Pixel 7 sizes. They cover student sign-in, reload persistence, sign-out, a student blocked from `/admin/`, admin lookup, a wrong password, and the forced password change with a policy error.
- Backend: the repository contract suite passes against the in-memory store. The same suite runs against MongoDB in CI.
