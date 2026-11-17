# System architecture

## Context

```mermaid
flowchart LR
  student([Student]) -->|browser or phone| web
  admin([Registry administrator]) -->|browser or phone| web
  student --> mobile
  admin --> mobile
  subgraph Render["Render web service (one origin)"]
    web["Web client<br/>Next.js static export"]
    api["API<br/>Node.js + Express, /api/v1"]
    web -->|same-origin fetch| api
  end
  mobile["Mobile app<br/>Flutter, Android and iOS"] -->|HTTPS| api
  api --> db[("MongoDB Atlas")]
  gh["GitHub Actions"] -->|CI; manual seeding workflows| db
```

- **One origin.** The API serves the static web client and the legacy demo at `/demo/`, so the browser needs no CORS and cookies stay first-party ([ADR 0001](adr/0001-single-origin-render-service.md)).
- **Mobile** calls the same API over HTTPS. Native requests carry no `Origin`, so CORS does not apply. The app stores the refresh cookie in the platform keystore.

## Containers and main components

```mermaid
flowchart TB
  subgraph API["web-app/backend"]
    http["http/: routes, auth middleware,<br/>permission checks, validation (zod)"]
    auth["auth/: sign-in, Argon2id, JWT,<br/>rotating refresh tokens, lockout"]
    elig["eligibility/: assess, curriculum lookup,<br/>standings for many students"]
    domain["domain/eligibility/: pure audit engine,<br/>standing, pass marks, terms"]
    search["search/: ID, name and typo ranking"]
    reports["reports/, register/: aggregation, CSV"]
    imports["imports/, records/: CSV and manual edits"]
    repos["repositories/: interface, MongoDB and<br/>in-memory implementations"]
    http --> auth & elig & search & reports & imports
    elig --> domain
    auth & elig & reports & imports --> repos
  end
  subgraph Web["web-app/frontend (Next.js, static export)"]
    pages["app/: student and admin pages"]
    client["lib/api.ts: typed client,<br/>silent refresh"]
    pages --> client
  end
  subgraph Mobile["mobile-app (Flutter)"]
    screens["features/: auth, student, admin"]
    mclient["core/api: client, keystore,<br/>offline cache"]
    screens --> mclient
  end
```

| Layer | Responsibility | Notes |
|---|---|---|
| `domain/eligibility` | Pure functions: programme audit, requirement tree, standing, pass marks, terms | No I/O; most of the backend's unit tests sit here |
| `eligibility` | Picks the curriculum for a student (Registry-reviewed for real students, illustrative synthetic rules for synthetic ones), applies the pass-mark catalogue and standing thresholds | Loads each distinct curriculum once per request when assessing many students |
| `repositories` | One interface (`types.ts`) with MongoDB (`mongo.ts`) and in-memory (`testing/memory-repositories.ts`) implementations | A shared contract test suite runs against both; MongoDB runs in CI |
| `http` | Routing, `authenticate`, `requirePermission`, input validation, audit logging | The role always comes from the stored account, never from the client |

## Key flows

**Sign-in and session**

```mermaid
sequenceDiagram
  participant C as Client
  participant A as API
  participant D as MongoDB
  C->>A: POST /auth/login {identifier, password}
  A->>D: find account, verify Argon2id hash, record attempt
  A-->>C: accessToken (15 min) + Set-Cookie agt_refresh (rotating, hashed at rest)
  C->>A: GET /students/me/eligibility (Bearer)
  A-->>C: assessment
  Note over C,A: Access token expires
  C->>A: POST /auth/refresh (cookie + x-requested-with)
  A->>D: revoke old token, issue new one in the same family
  A-->>C: new accessToken + new cookie
```

**Assessment.** Request → student record → curriculum (reviewed or synthetic) → apply pass marks → audit engine → standing with the configured thresholds → requirement tree and next actions. The register, reports and standing-based messaging all use the same path, so every screen agrees.

## Deployment and environments

| Environment | Where | Data |
|---|---|---|
| Live | Render web service from `main`, MongoDB Atlas | Seeded synthetic records and real accounts. No real student records until the Registry approves the curriculum |
| CI | GitHub Actions: backend (Node 22), MongoDB contract tests, frontend unit and Playwright (with axe), mobile (Flutter 3.47.9, APK) | In-memory and temporary MongoDB |
| Local | `npm run dev:demo` | In-memory synthetic data |

See [`../08-deployment/render-deployment-guide.md`](../08-deployment/render-deployment-guide.md), [`../08-deployment/environment-variables.md`](../08-deployment/environment-variables.md) and [`../08-deployment/mobile-release-guide.md`](../08-deployment/mobile-release-guide.md).
