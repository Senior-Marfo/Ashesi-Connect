# Render deployment guide

The whole application (API and web client) deploys as **one Render web service** from `render.yaml` in `Senior-Marfo/Ashesi-Connect`, branch `main`. ADR 0001 explains why it is one service.

## 1. Create the database (MongoDB Atlas)

1. Create a free **M0** cluster at https://cloud.mongodb.com. Pick a European region, close to Render's Frankfurt region.
2. **Database Access:** add a database user with a long random password and the *Read and write to any database* role.
3. **Network Access:** add `0.0.0.0/0` (required: without it the deploy fails with `MongooseServerSelectionError` / `ReplicaSetNoPrimary`). Render's free plan has no fixed outbound IP addresses. With a paid Render plan, list Render's outbound IPs instead.
4. **Connect → Drivers:** copy the `mongodb+srv://` string. Put the password in it and add a database name before the `?`, for example:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/ashesi_graduation?retryWrites=true&w=majority`

## 2. Create the Blueprint on Render

1. Sign in at https://dashboard.render.com with the GitHub account that can see `Senior-Marfo/Ashesi-Connect`.
2. Choose **New → Blueprint**, select the repository and branch `main`, and confirm `render.yaml` is detected.
3. Render asks for the variables marked `sync: false`:

   | Variable | Value |
   |---|---|
   | `MONGODB_URI` | The Atlas connection string from step 1 |
   | `SEED_ADMIN_STAFF_ID` | The first administrator's staff ID, matching `STF-` plus 4 to 6 digits, e.g. `STF-0001` |
   | `SEED_ADMIN_PASSWORD` | A temporary password: at least 12 characters, at least three of lowercase, uppercase, digits and symbols, and not containing the ID |

   Render generates `JWT_ACCESS_SECRET` itself. `NODE_ENV`, `NODE_VERSION` and `STATIC_DIR` are fixed in the Blueprint.
4. Click **Apply**. The build installs and builds the web client, then the API. That takes a few minutes. The service goes **Live** once `GET /health` returns `200`, which needs a working MongoDB connection.

## 3. First sign-in

1. Open the service URL, e.g. `https://ashesi-graduation-tracker.onrender.com`.
2. Sign in with `SEED_ADMIN_STAFF_ID` and `SEED_ADMIN_PASSWORD`. You'll be asked to set a new password straight away.
3. On Render, delete `SEED_ADMIN_PASSWORD` and `SEED_ADMIN_STAFF_ID` from the service's **Environment**. The account is created only once and never overwritten, but the temporary password shouldn't stay in the dashboard.

## Optional settings

| Variable | Default | Purpose |
|---|---|---|
| `STUDENT_ID_REGEX` | `^\d{8}$` | Accepted student ID format |
| `STAFF_ID_REGEX` | `^STF-\d{4,6}$` | Accepted staff ID format |
| `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL` | `900` / `604800` seconds | Session lifetimes |
| `LOCKOUT_THRESHOLD` / `LOCKOUT_MINUTES` | `5` / `15` | Account lockout |
| `LOGIN_RATE_LIMIT_MAX` / `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | `10` / `900` | Sign-in rate limit per IP address and ID |
| `TRUST_PROXY_HOPS` | `1` in production | Proxies in front of the app, used to find the client IP for rate limiting |

## Smoke test after each deploy

1. `GET /health` returns `{"status":"ok"}`.
2. The sign-in page loads, and `/demo/` shows the fictional legacy demo.
3. Admin sign-in works, and a student ID search returns results once students are imported.
4. In the browser's developer tools, the `agt_refresh` cookie is `HttpOnly`, `Secure` and `SameSite=Strict`, and reloading the page keeps you signed in.
5. Signing out and reloading returns to the sign-in page.

Record results in `docs/07-testing/test-reports/`.

## Rollback

On the service's **Events** page in Render, choose an earlier successful deploy and **Rollback**. Collections are additive (`users`, `refreshtokens`, `auditlogs`, `students`, `enrollments`), so an older build can run against the newer database.

## Data safety

Only synthetic records should be loaded until the Registry has confirmed the curriculum rules and pass thresholds (see `docs/00-governance/build-status.md`). Graduation figures shown are recorded credits, not eligibility decisions.
