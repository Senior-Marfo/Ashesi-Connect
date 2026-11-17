# Post-deploy smoke test — 2026-11-17

**Service:** https://ashesi-graduation-tracker.onrender.com (Render, one web service, MongoDB Atlas)
**Deployed code:** `main` at `f182094` (US-06 is on a branch and not yet deployed)
**Tool:** `web-app/backend/scripts/smoke-test.mjs`, also runnable as the manual **Post-deploy smoke test** workflow

## Anonymous checks — run from the development container

| Check | Result | Detail | Time |
|---|---|---|---|
| Health endpoint | Pass | status ok | 507 ms |
| Web client served | Pass | /, /student/, /admin/, /demo/ | 949 ms |
| Security headers | Pass | CSP, HSTS, nosniff, referrer policy | 359 ms |
| Anonymous admin request refused | Pass | 401 | 135 ms |
| Wrong password refused generically | Pass | 401 | 1908 ms |

**Result: pass.** The service answers, serves the static client and the legacy demo from the same origin, sends the expected security headers, refuses anonymous admin requests and gives a generic `401` for an unknown account.

## Signed-in checks — still to record

The signed-in checks use the accounts already in place on the live site:

| Role | Account | Password |
|---|---|---|
| Student | a synthetic student, by default `92800001` | `SYNTHETIC_STUDENT_PASSWORD` (already set for the seeding workflow) |
| Admin | `STF-0001`, the live administrator | `SMOKE_ADMIN_PASSWORD`: add it once as a repository secret holding STF-0001's current password |

Go to **Actions → Post-deploy smoke test (manual only) → Run workflow**. You can change the IDs there, and a blank ID skips that role. Copy the table from the run summary into a new dated report in this folder.

- If a password secret no longer matches, sign-in fails once and the remaining checks for that role are skipped. One failed attempt cannot lock the account.

The same script passed all 15 checks, signed-in ones included, against the local demo server (`npm run dev:demo`) on 2026-11-17.

Each run adds sign-in records and one failed sign-in for an account that doesn't exist to the audit log. It changes no student data, accounts or passwords.
