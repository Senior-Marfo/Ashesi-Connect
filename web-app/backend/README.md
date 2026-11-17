# Ashesi Graduation Tracker API

Express + TypeScript + MongoDB.

```bash
npm install
cp .env.example .env   # fill MONGODB_URI and JWT_ACCESS_SECRET
npm run dev            # http://localhost:4000
npm test               # unit and HTTP tests; no database needed
```

## Layout

| Path | Purpose |
|---|---|
| `src/server.ts` | Connects MongoDB and starts the HTTP server |
| `src/config.ts` | Validated environment configuration |
| `src/http/` | App factory, middleware and routes |
| `src/auth/` | Tokens, passwords, permissions and the auth service |
| `src/repositories/` | Repository interfaces and the Mongoose implementation |
| `src/domain/eligibility/` | Framework-free degree audit engine |
| `src/testing/` | In-memory repositories and fixtures for tests |

## Endpoints

| Method | Path | Access |
|---|---|---|
| GET | `/health` | public |
| POST | `/api/v1/auth/login` | public, rate limited |
| POST | `/api/v1/auth/refresh` | refresh cookie + `X-Requested-With` |
| POST | `/api/v1/auth/logout` | refresh cookie + `X-Requested-With` |
| POST | `/api/v1/auth/password` | any signed-in user |
| GET | `/api/v1/students/me` | `student:read:own` |
| GET | `/api/v1/admin/students?q=` | `student:read:any` |
| GET | `/api/v1/admin/students/:studentId` | `student:read:any` |
| POST | `/api/v1/admin/users/reset-password` | `user:reset-password` |
| GET | `/api/v1/admin/audit-log` | `audit-log:read` |

See `docs/06-sprints/sprint-02/US-01-secure-login.md` for the security design and `docs/02-requirements/rbac-permission-matrix.md` for permissions.
