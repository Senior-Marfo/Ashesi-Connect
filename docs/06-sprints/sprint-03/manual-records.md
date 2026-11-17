# Manual student and course records — Sprint 03

Master build prompt §6.4: "manual create/edit of students and course records".

**Owner role:** Registry administrator · **Story points:** 5 · **Permission:** `records:edit`

## Acceptance criteria

| # | Criterion | State |
|---|---|---|
| 1 | Admins can add a single student without a CSV file. | Done (Imports → Add one student) |
| 2 | The new student gets a locked account until an admin issues a temporary password, as with imports. | Done |
| 3 | Admins can edit a student's name, programme, year group and maths track. | Done (Student lookup → Edit record) |
| 4 | Admins can add a course, correct a grade, add a retake or remove a course, and the full attempt history is kept. | Done |
| 5 | Input follows the same rules as CSV imports, and refusals say what to fix. | Done |
| 6 | Each change is audit-logged with before and after values. | Done |
| 7 | Synthetic records cannot be changed here. | Done (`409 SYNTHETIC_RECORD`) |

## Rules

- **Attempts:** listed oldest first, at most 10, and only the latest can be in progress or incomplete. A graded attempt needs a grade from the scale. An in-progress or incomplete attempt has none. Credits run from 0.5 to 4 in 0.5 steps, and terms look like `2025 Fall`.
- **Course codes** are normalised (`math141` → `MATH 141`), the same as in CSV imports.
- **Audit entries:** `ADMIN_STUDENT_CREATED`, `ADMIN_STUDENT_UPDATED` (changed fields with their previous values), `ADMIN_COURSE_RECORD_UPDATED` and `ADMIN_COURSE_RECORD_REMOVED` (attempts summarised as, for example, `E > B`).
- **Synthetic records** belong to the seeding workflow, which regenerates them, so manual edits would be lost or would clash with it. The editor shows them as read-only.
- Standing, the register and reports pick up an edit on their next load. Nothing is cached.

## Evidence

- API tests: creation with a locked account; duplicate, bad-ID and validation refusals with messages; detail edits that log only changed fields; add, replace and remove a course with audit entries; every attempt rule; synthetic records refused; RBAC for the four routes.
- Component tests for the details form and the course editor (retakes, grade disabled while in progress, removal, server errors shown).
- A Playwright journey on desktop and phone: add a student, change their track, record MATH 141 with a retake, and see a synthetic record as read-only.

## Test note

The existing import journey filled the "Student ID" field before its client-side navigation finished. With a student ID field now also on the Imports page, the fill could land there. The journey now waits for the lookup page. The register journey's overall student count no longer assumes no other journey has added students; the filtered count of 7 is still checked.
