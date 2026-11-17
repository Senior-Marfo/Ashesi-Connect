# Degree audit 2028 workbook reconciliation — Sprint 04

Master build prompt §3.3: parse the workbook, recompute each category and overall total from its components, compare with the printed totals, and log every discrepancy.

## Done

- **Script fixed:** `scripts/ingest-degree-audit.ts` had never run on a real file (`XLSX.readFile` is unavailable under ES modules). It now parses the file's bytes and writes three outputs: the normalised preview, a reconciliation report and a course-mapping template. It still never writes to a database.
- **New `domain/eligibility/workbook-reconcile.ts`:**
  - Classifies each requirement line: a course (a `*` marks half credit), an either/or course ("A / B"), an alternate-track-only course, elective slots (with the African Studies minimum and free electives), or a conditional capstone.
  - Starts after the column headings, so the title and student fields are never read as requirements.
  - Checks every printed category, section and overall total on both maths tracks, both against the listed components and against the printed parts.
  - Courses listed with no printed total (LLB's IAP) are reported and left out of the sums rather than given invented credits.
- **New `domain/eligibility/workbook-report.ts`:**
  - Produces the Markdown report.
  - Produces the mapping CSV: one row per course or course option, with a suggested track for either/or maths courses and blank `course_code` and `minimum_grade` for the Registry to fill.
- **Results:**
  - BA, ECON, MIS, EE and LLB reconcile.
  - CS, CE, ME, MT and BE have printed totals that disagree with their components. Each was checked by hand and is logged with a question in `00-governance/requirements-discrepancies.md`.
  - The two differences the build prompt suspected (CS core, ME major) are confirmed. Three more were found (CE major total, MT and BE required major courses).

## Outputs

- `docs/02-requirements/degree-audit-2028/reconciliation.md`
- `docs/02-requirements/degree-audit-2028/curriculum-course-mapping.csv` (384 rows)
- The workbook itself is not committed. Its SHA-256 is recorded in both outputs.

## Next

1. The Registry completes the mapping (codes, elective lists, any C pass marks) and answers the discrepancy questions.
2. A converter turns the completed mapping into curriculum drafts (`curriculum-import.ts` format), one per programme and track.
3. Drafts are imported to staging, validated and reviewed in-app (`docs/controlled-curriculum-staging-runbook.md`).

## Evidence

Ten unit tests in `workbook-reconcile.test.ts`, built from hand-made sheets that cover each line kind, every discrepancy type, both tracks, the IAP case, the MIS free elective, track suggestions and both outputs. The backend suite passes (541 tests).
