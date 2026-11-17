# Error catalogue

Every error response is JSON: `{ "error": CODE, "message"?: "readable text" }`. Clients should branch on `error` and show `message` when present. The full contract is in [`openapi.yaml`](openapi.yaml).

## Authentication and access

| Code | Status | Meaning | What the client should do |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | Missing, expired or forged access token | Call `/auth/refresh` once, then retry; if that fails, sign in again |
| `INVALID_CREDENTIALS` | 401 | Wrong ID or password. Locked and unknown accounts get the same answer, so IDs cannot be probed | Show a generic "ID and password do not match" |
| `INVALID_REFRESH_TOKEN` | 401 | The refresh cookie is missing, expired, revoked or reused (reuse revokes the whole family) | Sign in again |
| `TOO_MANY_ATTEMPTS` | 429 | Sign-in rate limit for this IP address and ID (default 10 per 15 minutes) | Wait and retry |
| `PASSWORD_CHANGE_REQUIRED` | 403 | The account has a temporary password | Go to the password change screen |
| `WEAK_PASSWORD` | 422 | The new password breaks the policy; `message` names the rule | Show the message |
| `FORBIDDEN` | 403 | The role lacks the route's permission (for example, a student calling an admin route) | Do not offer the action |
| `CSRF_HEADER_MISSING` | 403 | `x-requested-with` header absent on refresh or logout | Always send it |
| `USER_NOT_FOUND` | 404 | No account for that ID (temporary password requests) | Check the ID |

## Input and records

| Code | Status | Meaning |
|---|---|---|
| `INVALID_INPUT` | 400 | The request failed validation. Many routes add a `message` naming the first problem (for example, "A completed attempt needs a grade.") |
| `NOT_FOUND` | 404 | No such student, course record, pass mark or route |
| `STUDENT_NOT_FOUND` | 404 | The signed-in student has no student record (curriculum routes) |
| `STUDENT_EXISTS` | 409 | Creating a student whose ID is already taken |
| `ACCOUNT_EXISTS` | 409 | Creating an administrator whose staff ID is already taken |
| `INVALID_STAFF_ID` | 400 | The staff ID does not match `STAFF_ID_REGEX` |
| `SYNTHETIC_RECORD` | 409 | Manual edits to a synthetic record; the seeding workflow owns those |

## Imports

| Code | Status | Meaning |
|---|---|---|
| `IMPORT_HAS_ERRORS` | 422 | Apply was called on a file that still has row errors; nothing was written |
| `NOT_LATEST_IMPORT` | 409 | Only the most recent applied import can be undone |

## Messaging

| Code | Status | Meaning |
|---|---|---|
| `NO_RECIPIENTS` | 422 | The audience matches nobody |
| `INVALID_SCHEDULE` | 400 | `sendAt` is less than a minute ahead or more than 180 days ahead |
| `NOT_CANCELLABLE` | 409 | The message was already delivered, or does not exist |

## Curriculum

| Code | Status | Meaning |
|---|---|---|
| `CURRICULUM_UNAVAILABLE` | 409 | No Registry-reviewed curriculum applies to this student |
| `ACADEMIC_PREVIEW_UNAVAILABLE`, `AUDIT_READINESS_UNAVAILABLE` | 503 | The database could not answer |
| `CURRICULUM_REVIEW_DISABLED` | 503 | `ENABLE_CURRICULUM_REVIEW` is not `yes` |
| `REVIEWER_NOT_AUTHORIZED` | 403 | The admin is not in `CURRICULUM_REVIEWER_IDS` |
| `CURRICULUM_NOT_FOUND` | 404 | No curriculum with that programme, track and version |

## Server

| Code | Status | Meaning |
|---|---|---|
| `INTERNAL_ERROR` | 500 | An unexpected failure. The response includes `requestId`; search the logs for it |
