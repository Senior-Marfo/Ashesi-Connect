# Dependency security pass — Sprint 04

`npm audit` on 2026-11-17 reported 9 findings in the backend (2 critical) and 10 in the frontend (2 critical).

| Package | Where it runs | Action | Result |
|---|---|---|---|
| `zod` 3.25 (memory exhaustion on oversized collections) | Every API request | Upgraded to 4.6.7. No code changes were needed; all 559 backend tests, including the exact validation messages, pass unchanged | Fixed |
| `postcss` 8.4.31 inside Next 15 (XSS in stringify output, file read) | Front-end build | An npm override pins 8.5.32 under Next, avoiding a jump to Next 16 | Fixed |
| `vitest` 3.2, `tinypool`, `@vitest/mocker` (critical) | Tests only | Upgraded to vitest 5.1.0 in both apps; every test passes unchanged | Fixed |
| `xlsx` 0.18.5 (prototype pollution, slow regex) | The hand-run ingestion script | Moved to development dependencies. The fixed release (0.20.3) is published only on cdn.sheetjs.com, which the development container cannot reach | Open, low risk (known issues) |
| `picomatch` 4.0.7 through Vite (slow regex) | Test and build tooling | No fixed release exists yet | Open, low risk (known issues) |

**After:** `npm audit --omit=dev` reports **0 vulnerabilities** for both apps. All findings left are in development tooling.

## Also in this change

`CURRICULUM_REVIEWER_IDS` accepts staff IDs (`STF-0001`) as well as internal account IDs, so an operator no longer has to look IDs up in MongoDB. A staff ID is matched against the stored account (never the request), only for admin accounts. If the lookup fails, the answer is "not allowed". Two new API tests cover this.
