# Data management: record imports — Sprint 03

`/admin/imports/` needs the new `records:import` permission (admins). Applying an import is logged as `ADMIN_IMPORT_APPLIED`, and undoing one as `ADMIN_IMPORT_ROLLED_BACK`.

## Formats

**CSV only (UTF-8; in Excel, "CSV UTF-8").** The `xlsx` parser has open security advisories, so `.xlsx` uploads are not parsed on the server. Each type has a downloadable template. Headers are case- and space-insensitive.

| Import | Columns | Rules |
|---|---|---|
| Students | `studentId, fullName, programme, yearGroup, track` | ID matches `STUDENT_ID_REGEX`; programme is one of the ten codes; year group is 2000–2100; track is `standard`, `pre-calculus` or `calculus-1-2` (default `standard`); no duplicate IDs. Existing students are updated. |
| Course records | `studentId, courseCode, credits, grade, status, semester` | One row per attempt, oldest first. The code looks like `CS 111` (`CS111` is normalised). Credits run in 0.5 steps up to 4. The grade is on the scale. Status is `completed` (implied by a grade), `enrolled` / `in progress`, or `incomplete`. A term looks like `2025 Fall`. The student must already exist. Each course in the file **replaces** that student's attempts for that course. |

## Safeguards

- **Preview first.** Every row is checked, and errors are listed by spreadsheet row and column (the first 200 shown, with the total). Nothing is written while any error remains.
- **All or nothing.** Applying re-validates the file on the server. One error refuses the whole file (`422 IMPORT_HAS_ERRORS`).
- **No mixing with synthetic data.** Synthetic student IDs can't be updated or given imported courses, and the synthetic seed already refuses to run on a database that holds real students.
- **Accounts for new students.** Each new student gets an account that needs a password change and has an unknowable placeholder password. In student lookup, **Issue temporary password** gives the admin a one-time password to pass on. The student must replace it at first sign-in.
- **Undo.** Each batch records what every change replaced. **Undo this import** restores it exactly: it removes created students and accounts, restores updated details and replaces or removes course records. Only the newest applied batch can be undone, so later imports never build on undone data.
- **Limits.** 4 MB per file and 20,000 rows. Bodies over 1 MB are accepted only on the import routes.

## Evidence

- Unit tests for the CSV parser (quotes, embedded newlines, CRLF, byte order mark, unterminated quotes) and for validating both file types.
- API tests: preview without writes, apply with locked accounts, refusal on any error, course imports, history with undo eligibility, undo order (newest first, `409` otherwise) and exact restoration, synthetic separation, file type and size limits, and RBAC.
- Repository contract tests for upsert, remove, set and remove course, account removal and batch history (in-memory, plus MongoDB in CI).
- A Playwright journey on desktop and phone: a file with errors is refused, the fixed file is applied, a temporary password is issued, the new student is made to change it, and the import is undone.
