# US-02 to US-05: Student eligibility screens — Sprint 03

| Story | Screen | What it shows |
|---|---|---|
| US-02: View graduation eligibility status | `/student/` | **Status card:** "All requirements met" or "Not yet eligible"; the standing (green / amber / red, each with an icon and text); the reasons in plain language; an animated progress ring of credits completed (with credits in progress shaded); credits completed and in progress; the expected graduation term; the top three next steps. Below it, progress bars for each requirement area. |
| US-03: View requirements for my programme | `/student/requirements/` | The full requirement tree grouped by category, plus the elective pools. Groups expand and collapse, there's a course-code search, and filter chips by state with counts (Completed, In progress, Remaining, Below pass mark, Incomplete). Each requirement shows its grade, number of attempts, pass mark and credits. Open elective slots list the courses that can fill them. |
| US-04: View remaining requirements | `/student/remaining/` | This term's courses in progress, then everything else placed in coming terms at about 5 credits a term: retakes first, then incompletes, required courses in plan order, and elective slots. Terms after the expected graduation are flagged. |
| US-05: View courses and grades with pass/fail | `/student/courses/` | Every course with its latest grade and earlier attempts. Graded courses are marked **Passed** or **Below pass mark** against that course's own pass mark (D+ or C). |

Admins see the same status card and requirement tree in student lookup.

## API

- `GET /api/v1/students/me/eligibility` (`student:read:own`) and `GET /api/v1/admin/students/:id/eligibility` (`student:read:any`, audit-logged as `ADMIN_ELIGIBILITY_VIEWED`) return the same assessment: `status`, `curriculum` (basis and version), `audit`, `standing`, `requirements`, `nextActions`, `expectedGraduation` and `issues`. `officialCertification` is always `false`.
- The standing rules are in `docs/03-design/severity-model.md`.

## Which rules apply

- **Real students:** only a Registry-reviewed, issue-free curriculum for their programme, track and cohort (`CurriculumRepository.findReviewed`). Without one, the status is `NO_CURRICULUM` and the screens explain that. Nothing is estimated.
- **Synthetic students:** the illustrative rules in `src/seed/synthetic-curriculum.ts`, generated from the same plan as the synthetic records. A test checks that every synthetic course is covered and that most graduated synthetic students meet the rules. Screens and responses label this basis.
- If a grade isn't on the scale, the status is `DATA_ISSUES`, with the course named, rather than a guessed result.

## Changes to synthetic data

The generator now retakes courses that fall below their **own** pass mark (C for upper-level major courses and the capstone), redoes incompletes, and uses slightly lighter loads. About 87% of the 2025 cohort now meet every requirement, close to a real graduation rate. The amber and red cases cover failed courses, heavy remaining loads and unfinished past-graduation students. Re-run the seed workflow to load the updated records; synthetic passwords are kept.

## Known gaps

- The engine's `africanStudies` flag on transcript entries is never set by the transcript mapping, so a pool using `africanStudiesMinimum` always reports African Studies as missing. The synthetic rules avoid this by making African Studies its own pool. Real curricula need either a mapping fix or the same modelling.
- The older `/students/me/academic-preview` route is kept for compatibility but is no longer used by the web client.

## Evidence

- Backend: standing, terms and requirement-breakdown unit tests; synthetic-rule consistency tests; and API tests covering real students with no curriculum or a reviewed one, synthetic students, data issues, admin access with audit logging, and isolation.
- Frontend: component tests for the standing badge, status card, unavailable state, tree filtering and search, and the remaining plan's term placement. A Playwright journey covers Status → Requirements → Remaining → Courses on desktop and phone, and the admin profile showing standing.
