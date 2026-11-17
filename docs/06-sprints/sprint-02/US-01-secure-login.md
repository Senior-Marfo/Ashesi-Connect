# US-01: Secure login by Student or Staff ID — Sprint 02

## Implemented

- **One login for both roles.** Students and staff use the same form. The backend checks the ID against `STUDENT_ID_REGEX` / `STAFF_ID_REGEX`, finds the account and takes the role from the stored record. Unknown IDs, malformed IDs, wrong passwords and locked accounts all return the same `401 INVALID_CREDENTIALS`, and unknown IDs still run a password verification so response timing doesn't reveal which IDs exist.
- **Short-lived access tokens.** HS256 JWTs with a 15-minute default lifetime (`ACCESS_TOKEN_TTL`), pinned issuer, audience and algorithm.
- **Rotating refresh tokens.** Each token is an opaque 256-bit random value in an `httpOnly` cookie scoped to `/api/v1/auth`. Only its SHA-256 hash is stored. Every refresh revokes the presented token and issues a new one in the same family. If a token that was already rotated is presented again, the whole family is revoked and the user has to sign in again. A conditional update stops two concurrent refreshes from both succeeding. MongoDB's TTL index removes expired records.
- **Cookie policy.** In development: `SameSite=Lax`. In production: `Secure; SameSite=None`, because the static site and the API run on different `onrender.com` subdomains, which browsers treat as different sites. `/auth/refresh` and `/auth/logout` require an `X-Requested-With` header, which a cross-site page cannot send without a CORS preflight that the allow-list rejects.
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

## Merge note for `feat/2028-workbook-safe-import`

That branch's `routes/curriculum.ts` imports `requireAuth`, `requireRole` and `AuthenticatedRequest` from the removed `src/auth.ts`. When merging:

- mount the router inside `createApp` after `authenticate(config.accessTokenSecret), requirePasswordChanged()`;
- replace `requireRole('ADMIN')` with a new permission such as `curriculum:review`;
- read `req.auth` directly (it is typed on `Request`).

Its seed script creates the IDs `demo.student.2028` and `demo.admin`. Staging must therefore set `STUDENT_ID_REGEX` / `STAFF_ID_REGEX` to accept them, or the seed should switch to IDs that match the default formats.
