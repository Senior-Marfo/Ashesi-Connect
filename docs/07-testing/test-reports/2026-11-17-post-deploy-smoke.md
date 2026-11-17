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

Sign-in, the student's status, admin search, the register and report generation need a live student and admin account. Their passwords are deployment secrets, so they are not run from the development container.

To run them:

1. In GitHub, go to **Settings → Secrets and variables → Actions** and add `SMOKE_ADMIN_ID`, `SMOKE_ADMIN_PASSWORD`, `SMOKE_STUDENT_ID` and `SMOKE_STUDENT_PASSWORD`. Use accounts that have already replaced their temporary password, such as a synthetic student and a dedicated smoke-test admin.
2. Go to **Actions → Post-deploy smoke test (manual only) → Run workflow**.
3. Copy the table from the run summary into a new dated report in this folder.

The same script passed all 15 checks, signed-in ones included, against the local demo server (`npm run dev:demo`) on 2026-11-17.

Each run adds sign-in records and one failed sign-in for an account that doesn't exist to the audit log. It changes no student data.
