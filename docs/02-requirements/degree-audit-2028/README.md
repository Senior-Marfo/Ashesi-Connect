# 2028 curriculum: from workbook to reviewed curriculum

The Registry's `Degree_Audit_2028.xlsx` lists each programme's requirements by course **name**. Student records use course **codes**. This folder holds what is needed to bridge the two.

| File | What it is |
|---|---|
| [`reconciliation.md`](reconciliation.md) | Every printed total checked against its components. Questions for the Registry are in [`../../00-governance/requirements-discrepancies.md`](../../00-governance/requirements-discrepancies.md) |
| [`curriculum-course-mapping.csv`](curriculum-course-mapping.csv) | One row per course or course option (384 rows) for the Registry to complete |

## Completing the mapping (Registry)

Open the CSV in Excel or Google Sheets, fill in these columns, and save it as CSV again. Leave the other columns unchanged.

| Column | Fill in |
|---|---|
| `course_code` | The course's code, like `CS 212`. For **elective slot** rows (`kind` = ELECTIVE_SLOTS), list every allowed course separated by semicolons: `CS 351; CS 352; CS 361`. Mark African Studies courses with a trailing `*`: `AS 101*; AS 102*; ECON 210` |
| `minimum_grade` | Leave blank for D+, or write `C` where the course needs a C. On an elective row it applies to every course in the list |
| `track` | Only on rows that say `confirm`, or to correct a suggestion: `standard`, or the alternate track exactly as other rows show it (for example `alternate (Pre-Calc)`) |
| `credits` | Only to correct a figure. Enter `0` for a requirement that carries no credit (such as LLB's IAP courses); it is then listed but not counted |

Rows whose `kind` is ALTERNATIVE come in pairs: one option per track (for example "Pre-Calculus 1" for the Pre-Calc track and "Calculus 1" for the standard track). Both need a code.

The answers to the discrepancy questions may change credits or add a course. Edit the rows to match the Registry's decision, and add a row for any missing course.

## Building and loading the drafts (technical)

```sh
cd web-app/backend
npx tsx scripts/build-curriculum-drafts.ts ../../docs/02-requirements/degree-audit-2028/curriculum-course-mapping.csv \
  --source-url https://<where the Registry publishes the workbook> \
  --workbook-sha256 6c88df76001f55894927694f3395c7f3d87073267a1978502faf729d4742c354 \
  --version 2028-v1 --out curriculum-drafts
```

1. The script checks every row and writes one draft per programme and track (for example `CS-standard.json`, `CS-pre-calculus.json`) and `drafts-summary.md`. Any problem is listed with its row number, and that programme gets no draft. Fix the CSV and run it again.
2. Each draft's total is the sum of its components, because several printed totals disagree with them. The summary shows every total so the Registry can confirm it.
3. Import each draft to the staging database: `scripts/import-curriculum-draft.ts <draft.json>` (a dry run by default; see [`../../controlled-curriculum-staging-runbook.md`](../../controlled-curriculum-staging-runbook.md)).
4. A listed Registry reviewer marks each draft reviewed in the app. Only then do real students on that programme and track get a standing.

To check a new version of the workbook, run `scripts/ingest-degree-audit.ts <workbook.xlsx> <output-dir>`. It writes a fresh reconciliation report and template; compare them with the ones here.
