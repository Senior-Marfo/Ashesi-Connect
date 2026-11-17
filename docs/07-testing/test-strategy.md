# Test strategy

## Layers

| Layer | Tool | Where | What it proves | Runs |
|---|---|---|---|---|
| Audit engine and domain | Vitest | `web-app/backend/src/domain/**` | Requirements, retakes, per-course pass marks, electives, standing, terms; pure functions | Every push |
| API | Vitest + Supertest, in-memory repositories | `web-app/backend/src/http/*.http.test.ts` | Every route's behaviour, validation, audit logging, permissions (`authorization.http.test.ts` checks every admin route rejects students and anonymous callers) | Every push |
| Repository contract | Vitest, same suite on memory and MongoDB | `repositories/contract.ts` | Both storage implementations behave the same | Every push (`backend-mongodb` job) |
| Web components | Vitest + Testing Library | `web-app/frontend/components/*.test.tsx`, `lib/*.test.ts` | Rendering, forms, error states, local storage handling | Every push |
| Web journeys | Playwright, desktop and phone | `web-app/frontend/e2e/journeys.spec.ts` | Real browser, real API (in-memory demo server), end to end | Every push |
| Accessibility | axe-core in Playwright | `e2e/accessibility.spec.ts` | No serious or critical WCAG 2.2 AA findings on every main screen | Every push |
| Mobile | `flutter test` (unit and whole-app widget tests with a fake server) | `mobile-app/test` | API client token handling, models, role routing, app lock, screens, offline mode | Every change under `mobile-app/` |
| Mobile build | `flutter build apk` (iOS without signing on demand) | `mobile-ci.yml` | The app compiles for the device | Every change under `mobile-app/` |

## Principles

- **Synthetic data only.** The fixtures and the demo server use fictional students; real records never enter tests.
- **One path, many screens.** The register, reports and messaging use the same assessment code the student sees, and are tested through the API rather than re-implemented in tests.
- **Regression proof for risky changes.** Before changing shared behaviour on the live data, compare the outputs of `main` and the branch on the 600-student synthetic dataset (done for the pass-mark change; see `docs/06-sprints/sprint-03/course-pass-marks.md`).
- **Fail closed.** Tests assert that unreviewed curricula, unknown grades and missing data produce no eligibility decision.

## Not automated

- Screen readers (VoiceOver, TalkBack, NVDA) and 400% zoom: manual, before each release.
- Biometric prompts on real devices.
- Load testing: not done. At 600 students, every request completes well within a second in CI.
- Post-deploy checks: manual. The owner confirms sign-in on the live site after each deploy; see the [UAT script](uat-script.md).
