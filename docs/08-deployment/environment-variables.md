# Environment variables

The API reads its configuration at startup (`web-app/backend/src/config.ts`) and refuses to start if a value is invalid. On Render they go under the service's **Environment**. Never commit values.

## API service (Render)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | yes (`production`) | `development` | Production turns on Secure cookies and stricter behaviour |
| `MONGODB_URI` | yes | — | MongoDB Atlas connection string, including the database name |
| `JWT_ACCESS_SECRET` | yes | — | At least 32 random characters; changing it signs everyone out |
| `STATIC_DIR` | yes on Render | — | Built web client to serve (`../frontend/out`) |
| `PORT` | no | `4000` | Render sets this itself |
| `ACCESS_TOKEN_TTL` | no | `900` (15 min) | Access token lifetime |
| `REFRESH_TOKEN_TTL` | no | 7 days | Refresh token lifetime |
| `REFRESH_COOKIE_SAMESITE` | no | `strict` | Only change for a cross-site client |
| `CORS_ORIGINS` | no | empty | Comma-separated origins for a browser client on another origin; not needed on the single-origin deploy or for the mobile app |
| `STUDENT_ID_REGEX` | no | `^\d{8}$` | Accepted student ID format |
| `STAFF_ID_REGEX` | no | `^STF-\d{4,6}$` | Accepted staff ID format |
| `LOGIN_RATE_LIMIT_MAX` | no | `10` | Sign-in attempts per IP address and ID per window |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | no | `900` | Rate-limit window |
| `LOCKOUT_THRESHOLD` | no | `5` | Failures before an account locks |
| `LOCKOUT_MINUTES` | no | `15` | Lock duration |
| `TRUST_PROXY_HOPS` | no | `1` in production, otherwise `0` | Proxies in front of the app, so rate limits see the real client address |
| `SEED_ADMIN_STAFF_ID`, `SEED_ADMIN_PASSWORD` | first deploy only | — | Creates the first admin once, with a forced password change. Remove both afterwards |
| `ENABLE_CURRICULUM_REVIEW` | no | off | `yes` allows the curriculum review endpoint |
| `CURRICULUM_REVIEWER_IDS` | with the above | — | Comma-separated admins allowed to review, by staff ID (`STF-0001, STF-0002`) or internal account ID |
| `ALLOW_CURRICULUM_DRAFT_WRITE` | no | off | Allows the controlled curriculum draft import script to write |

## GitHub Actions secrets (manual workflows)

| Secret | Used by | Purpose |
|---|---|---|
| `MONGODB_URI` | Load or remove synthetic student records; synthetic staging seed | Target database |
| `SYNTHETIC_STUDENT_PASSWORD` | Load or remove synthetic student records | Shared sign-in password for synthetic students |
| `DEMO_STUDENT_PASSWORD`, `DEMO_ADMIN_PASSWORD` | Synthetic staging seed | Staging accounts `20289001` and `STF-9001` |

## Mobile build

| Setting | How | Default |
|---|---|---|
| `API_BASE_URL` | `--dart-define=API_BASE_URL=…`, or the workflow input when starting Mobile app CI by hand | `https://ashesi-graduation-tracker.onrender.com` |

## Local and test only

| Variable | Purpose |
|---|---|
| `MONGO_INTEGRATION=1` | Runs the repository contract tests against a temporary MongoDB (`npm run test:integration`) |
| `MODE`, `SEED_CONFIRM`, `SYNTHETIC_COUNT`, `SEED_SYNTHETIC_STAGING` | Confirmations and options for the seeding scripts (see the deployment guide) |
