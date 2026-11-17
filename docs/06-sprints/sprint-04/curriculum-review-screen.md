# Curriculum review screen — Sprint 04

The last step of the curriculum pipeline (workbook → mapping → drafts → staging import → **review**) had no screen. A reviewer would have had to call the API by hand, without seeing what they approved. Reviews weren't audit-logged either.

## Done

- **Curriculum page** (admin menu). The catalogue moved here from Student lookup. **View** shows a version's required courses by category (credits, pass marks, C marked), elective slots with their options (African Studies marked), totals, the source workbook and any validation issues.
- **Review:** for a valid draft, the reviewer enters the evidence of Registry approval, confirms they checked it, and marks it reviewed. The page says why review isn't possible when it isn't: review switched off, not on the reviewer list, validation issues, or already reviewed.
- **API:**
  - `GET /admin/curricula/detail` and `GET /admin/curricula/review-access` are new.
  - The catalogue list and the review go through the repository layer (`findVersion`, `list`, `markReviewed`), so they work in the in-memory demo and tests as well as on MongoDB. The review's gates are unchanged and stay in the same order.
  - Each review writes `ADMIN_CURRICULUM_REVIEWED` with the evidence reference.
- **Fix:** the in-memory store treated any stored curriculum as reviewed; it now requires REVIEWED with no issues, like MongoDB.
- **Demo data:** the demo server holds one synthetic draft (`SYNTHETIC-DEMO-1`, year group 2099, so it never applies to a demo student). Review is switched on only for the browser tests.

## Evidence

- API tests: detail, access, and the full review in memory (applies to the cohort afterwards; a second review is refused; issues and unknown versions refused; non-reviewers refused; audit entry).
- Repository contract tests for `list`, `findVersion` and `markReviewed`, also run on MongoDB in CI. A MongoDB end-to-end review test runs in the CI integration job, which now includes `src/routes`.
- Component tests for the review panel.
- Playwright: inspect and review the synthetic draft. The axe accessibility checks now cover the Curriculum page with a draft open.
