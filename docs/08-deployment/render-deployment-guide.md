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

## 4. Load synthetic student records (optional)

A new database has no students. To demonstrate the site, load fictional records: 600 students across all ten programmes and the 2025–2030 year groups, with grades, failed courses, retakes and courses in progress. The course codes and plans are illustrative only, not the official curriculum.

The safeguards:

- Every record is marked `synthetic: true` and uses a reserved student ID range (`92500001`–`93099999`).
- The admin screens label these records as "Synthetic".
- Seeding refuses to run if the database already holds any non-synthetic student.
- Removing them deletes only synthetic records.

1. In GitHub, go to **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `MONGODB_URI`: the same connection string Render uses.
   - `SYNTHETIC_STUDENT_PASSWORD`: one shared sign-in password for all synthetic students. It must follow the password rules (at least 12 characters, at least three of lowercase, uppercase, digits and symbols).
2. Go to **Actions → Load or remove synthetic student records → Run workflow**.
   - Run it first with **mode `dry-run`** to see the counts. This doesn't connect to the database.
   - Then run with **mode `seed`** and confirmation `SYNTHETIC_RECORDS_ONLY`.
3. Sign in to the site as an admin and search for `928` to see the 2028 cohort. Any synthetic student can sign in with their ID (e.g. `92800001`) and `SYNTHETIC_STUDENT_PASSWORD`.

Running `seed` again regenerates the same records and keeps passwords that students have changed. To clear them before loading real data, run the workflow with **mode `remove`** and the same confirmation.

You can also run it from a computer with Node.js 22: in `web-app/backend`, run `npm ci`, then `MODE=seed SEED_CONFIRM=SYNTHETIC_RECORDS_ONLY MONGODB_URI=... SYNTHETIC_STUDENT_PASSWORD=... npm run seed:synthetic`.

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
