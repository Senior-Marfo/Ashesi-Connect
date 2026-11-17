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

Sign-in, the student's status, admin search, the register and report generation use the accounts seeded in the earlier deployment session. No new accounts or secrets are needed:

| Role | Account | Password secret (already set for the seeding workflows) |
|---|---|---|
| Student | a synthetic student, by default `92800001` (**Load or remove synthetic student records**) | `SYNTHETIC_STUDENT_PASSWORD` |
| Admin | `STF-9001` (**seed-synthetic-staging**) | `DEMO_ADMIN_PASSWORD` |

Go to **Actions → Post-deploy smoke test (manual only) → Run workflow**. You can change the IDs there, and a blank ID skips that role. Copy the table from the run summary into a new dated report in this folder.

- If an account's password was changed after seeding, its secret no longer matches. Sign-in then fails once and the remaining checks for that role are skipped. One failed attempt cannot lock the account.
- If the live database is not the staging database, `STF-9001` may not exist. Enter another admin ID whose password matches `DEMO_ADMIN_PASSWORD`, or leave the field blank.

The same script passed all 15 checks, signed-in ones included, against the local demo server (`npm run dev:demo`) on 2026-11-17.

Each run adds sign-in records and one failed sign-in for an account that doesn't exist to the audit log. It changes no student data, accounts or passwords.
