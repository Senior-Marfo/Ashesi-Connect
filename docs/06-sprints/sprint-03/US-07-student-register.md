# US-07: Student register — Sprint 03

## Implemented

- **Register at `/admin/register/`.** A table of every student, filterable by programme, year group and "needs attention", sortable by every column, 50 rows per page. Each student ID links to the full record in student lookup (`/admin/?student=<id>`).
- **Columns:** passed credits, credits in progress, failed courses not yet retaken, and flags (`UNRESOLVED_FAILURE`, `INCOMPLETE`, `NO_RECORDS`). Each value comes from the **latest attempt** at each course, so a failed course that was later passed doesn't count against the student.
- **Summary counts** for the current programme and year-group filter: students, students with a failed course not yet retaken, and students with an incomplete course.
- **CSV export** of the filtered, sorted register (`GET /api/v1/admin/register.csv`). It has a UTF-8 byte order mark so it opens cleanly in Excel. Cells that would start a spreadsheet formula are prefixed so they stay text.
- **Audit log.** Every register view (`ADMIN_REGISTER_VIEWED`) and export (`ADMIN_REGISTER_EXPORTED`) is recorded with the filters used.
- Synthetic records are tagged in the table and the CSV.

## Standing (added with US-02 to US-05)

- Each row carries the advisory `standing` from the same assessment the student screens use. Students without an applicable curriculum show `UNDETERMINED` ("Not determined").
- The register can be filtered by standing, sorted with the most serious first, and counts students at each level. Standing is included in the CSV.

## Deliberately not implemented
- **Per-course pass marks.** The register uses the provisional D+ pass mark from the assumptions log, and the column heading and CSV header say so.

## Design

- **MongoDB:** an aggregation over `enrollments` groups each student's latest attempts into credit and flag totals (`StudentRepository.courseSummaries`).
- **In-memory store:** reproduces the same logic, and the shared repository contract test checks both give identical results.
- **Register logic:** filtering by flag, sorting and paging are a pure function (`src/register/register.ts`). Paging past the end returns the last page.
- **Scale:** at the current size (hundreds of students) the summaries are computed per request. Above a few thousand students, cache the summaries or keep them on the student documents.

## Evidence

- Backend: register unit tests, repository contract tests (in-memory, plus MongoDB in CI), and API tests for filters, sorting, paging, input validation, CSV and the audit log. Both register routes are in the RBAC test list (`403` for students, `401` anonymous).
- Frontend: API client tests for query encoding and CSV download with token refresh, and a Playwright journey that filters, sorts, downloads the CSV and opens a student from the register.
