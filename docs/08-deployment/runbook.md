# Operations runbook

For the live service at https://ashesi-graduation-tracker.onrender.com (one Render web service, MongoDB Atlas).

## Daily checks

- `GET /health` returns `{"status":"ok"}`. A `503` means the database is unreachable (see below).
- Look at the latest **Production application CI** and **Mobile app CI** runs on `main` in GitHub Actions.

## Common tasks

| Task | How |
|---|---|
| A student or admin forgot their password | Admin: **Student lookup → Issue temporary password** (students), or **Settings → Administrators** for a new admin. Share it privately; it must be changed at first sign-in |
| Someone is locked out | Wait 15 minutes, or issue a temporary password (this also clears the lock) |
| Add an administrator | **Settings → Administrators → Create administrator** |
| Load or remove the synthetic demonstration cohort | GitHub Actions → **Load or remove synthetic student records** (dry-run first; `SYNTHETIC_RECORDS_ONLY` confirmation) |
| Load real students and courses | **Imports**: preview, fix every row error, apply. Undo restores exactly what was there before |
| Correct one record | **Student lookup → Edit record** (real records only) |
| Record a Registry pass-mark decision | **Settings → Course pass marks**, citing the source |
| Find who did something | **Settings → Audit log**, filtered by activity |
| Investigate a `500` | The response has a `requestId`. Search the Render logs for it |

## Incidents

| Symptom | Likely cause | Action |
|---|---|---|
| Site slow for about a minute, then fine | Render free tier waking from sleep | None; upgrade the plan to avoid sleeping |
| `/health` returns 503 | Atlas unreachable: network access list, paused cluster or wrong URI | Check Atlas **Network Access** (Render needs `0.0.0.0/0` or its egress IPs) and that the cluster is running; restart the Render service |
| Service won't start; one-line startup error in the logs | A missing or invalid environment variable | Fix it under **Environment** ([list](environment-variables.md)); the error names the variable |
| Everyone signed out at once | `JWT_ACCESS_SECRET` changed, or refresh tokens revoked | Expected after a secret change; people sign in again |
| Many `TOO_MANY_ATTEMPTS` | Repeated sign-in attempts from one address | Check the audit log for `AUTH_LOGIN_FAILED`; the limits are configurable |
| `AUTH_REFRESH_REUSE_DETECTED` in the audit log | A refresh token was replayed, possibly stolen | The family is already revoked; issue that person a temporary password and check their devices |

## Backups

MongoDB Atlas handles backups. On the free tier there are no automatic snapshots, so before any bulk import, export with `mongodump` (or use a paid tier with continuous backup). Each import can also be undone in the app.

## Releases

Merge to `main`, then Render deploys automatically. Watch the deploy logs, then open `/health`, sign in as an admin, open a student and load Reports. To roll back, see [rollback-plan.md](rollback-plan.md).
