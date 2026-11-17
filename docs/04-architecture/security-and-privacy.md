# Security and privacy

## Authentication

- One sign-in for everyone. The server matches the ID to an account and the role comes from that record, never from the client.
- Passwords are hashed with Argon2id. The policy is at least 12 characters, at least three of lowercase, uppercase, digits and symbols, and must not contain the ID.
- Access tokens are JWTs that last 15 minutes. Refresh tokens rotate on every use, are stored only as hashes, and reuse revokes the whole family. On the web the refresh token is an httpOnly cookie (Secure in production, SameSite=Strict by default) scoped to `/api/v1/auth`. On mobile it is kept in the Keychain or Android Keystore.
- Lockout after 5 failures for 15 minutes, plus a sign-in rate limit of 10 per 15 minutes per IP address and ID. Unknown, locked and wrong-password attempts all get the same generic response.
- Temporary passwords (admin reset, new accounts) must be changed before any other route works.
- Mobile can add an optional device unlock (Face ID, fingerprint or passcode) that relocks after a minute in the background.

## Authorisation

Permission checks happen on every route ([permission matrix](../02-requirements/rbac-permission-matrix.md)). Student routes read the student ID only from the verified token, so there is no route where a student names another student. Automated tests confirm that a student token gets 403 on every admin route and cannot reach another student's data (`authorization.http.test.ts`).

## Transport and browser protection

HTTPS only (HSTS). The Content-Security-Policy limits scripts, styles, images and API calls to the same origin; fonts may also come from HTTPS sources. Also `frame-ancestors 'none'`, `nosniff` and `no-referrer`. A CSRF header is required on refresh and logout. Temporary passwords and session responses are sent with `Cache-Control: no-store`.

## Audit trail

Every admin read and change of student data is logged with the actor, subject, request ID and IP address: searches, profile and audit views, exports, notes, record edits, imports and undo, messages, settings, pass marks, account creation and password resets. Sign-ins, failures, lockouts, password changes and refresh-token reuse are logged too. Admins can read the log under Settings; reading it is also logged.

## Privacy

- **Least data:** student records hold ID, name, programme, year group, track and courses. There are no contact details, demographics or financial data.
- **Staff notes** are visible to administrators only; a test confirms no student route returns them.
- **Synthetic data** is clearly labelled and removable. Real student data must not be loaded until the Registry has approved the curriculum and data handling.
- **Mobile:** the offline cache holds the student's own last status and courses, and is cleared on sign-out. Android cloud backup is disabled.
- **Admin browsers:** "Recently opened" students are kept in that browser only (ID and name).

## Known gaps

- Admin sign-in is password-only. Multi-factor authentication would be the next step for a production rollout.
- There is no data-retention schedule for audit logs or messages yet; it needs a Registry and legal decision.
- Accessibility and security reviews by people outside the project have not happened yet.
