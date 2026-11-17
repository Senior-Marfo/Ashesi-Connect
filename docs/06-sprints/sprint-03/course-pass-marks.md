# Course pass marks (D+ or C) — Sprint 03

Master build prompt §3.4 and §6.4: "Minimum passing grade is per course … Provide … an admin UI to edit thresholds, with an audit trail."

**Owner role:** Registry administrator · **Story points:** 5 · **Permission:** `settings:manage`

## Acceptance criteria

| # | Criterion | State |
|---|---|---|
| 1 | Admins can set any course's pass mark to D+ or C, with an optional source note, and remove it. | Done |
| 2 | Courses without a pass mark pass at D+. | Done |
| 3 | The new pass mark applies at once to student audits, requirement trees, the register, reports and course summaries. | Done |
| 4 | Each change is audit-logged with the new and previous value. | Done |
| 5 | Students see each course's pass mark on their requirements. | Done (existing "Pass mark" label) |

## Rules

- **Which pass mark applies:** the catalogue entry if there is one, otherwise the curriculum rule's own mark, otherwise D+. A catalogue entry can raise a curriculum's D+ to C or lower its C to D+.
- **Electives:** a catalogue entry applies to that course inside an elective pool (`courseMinimums` in `ElectiveRule`). Other pool courses use the pool's own mark, or D+.
- **Register and reports** do not read curricula, so they use the catalogue entry or D+. The MongoDB course-summary aggregation chooses the passing grades for each course with a `$switch` built from the catalogue.
- Course codes are normalised: `math141` becomes `MATH 141` and must match `^[A-Z]{2,5} \d{3}[A-Z]?$`, the same rule as CSV imports.

## Behaviour change

Elective pools without a pass mark used to pass a D in the audit engine, while the register and reports counted a D as a fail. Electives now default to D+ like every other course. A student with a D in an elective that has no pass mark now has that elective slot open. This matches the documented provisional rule (`assumptions-log.md`).

## Not done, on purpose

There is no `catalogue-pass-thresholds.json` seed file. No confirmed list of C courses exists, and seeding guesses into the live database would mark real students as failing. The assumptions log records this.

## Evidence

- Unit tests: grade comparison, catalogue lookup with the D+ fallback, query grouping, override of required and elective courses, and an end-to-end engine result.
- Requirement-breakdown test updated for the D+ elective default, plus a per-course elective mark.
- Report tests for pass rates and failures under a C mark.
- Repository contract tests for the pass-mark store and for course summaries under C marks (also against MongoDB in CI).
- API tests: a C mark turns a D+ into a failure in the audit, register and reports, and removing it restores D+; validation; audit entries; RBAC for the three routes.
- Component tests for the settings section; a Playwright journey (desktop and phone) where an admin sets C on MATH 141, the student sees "Pass mark C", and the admin removes it.
