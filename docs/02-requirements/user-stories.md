# User stories

Stories follow the master build prompt's numbering (`US-xx`). **Done** means built, tested in CI and documented; **Partial** and **Blocked** say what is missing.

## Students

| ID | Story | Status | Where |
|---|---|---|---|
| US-01 | Sign in securely with my student or staff ID | Done | `sprint-02/US-01-secure-login.md` |
| US-02 | See whether I am eligible to graduate | Done (advisory; real students need the reviewed curriculum) | `sprint-03/US-02-to-05-student-eligibility.md` |
| US-03 | See the requirements for my programme and track | Done | as above |
| US-04 | See what remains, with reasons | Done | as above |
| US-05 | See my courses and grades with pass/fail against each course's pass mark | Done | as above |
| US-13 | See an animated progress ring and a path-to-graduation timeline | Done (web and mobile) | Status and Remaining screens |
| US-14 | Change my password and view my programme details | Done | `sprint-03/remaining-web-features.md` |
| US-15 | Use the tracker on my phone | Done (Android build in CI; iOS builds unsigned) | `sprint-04/mobile-app.md` |
| US-16 | See my last status offline | Done (mobile) | as above |
| US-17 | Unlock the app with Face ID or fingerprint | Done (mobile, optional) | as above |
| US-18 | Get push notifications for new messages | Blocked: needs a Firebase project | `09-handoff/known-issues.md` |

## Administrators

| ID | Story | Status | Where |
|---|---|---|---|
| US-06 | Search for a student by ID or name, tolerating typos, and open their profile | Done | `sprint-03/US-06-student-search.md` |
| US-07 | See a colour-coded register of every student with filters, sorting and CSV | Done | `sprint-03/US-07-student-register.md` |
| US-08 | Report graduation rates by year | Done (advisory completion rate) | `sprint-03/US-08-to-10-reports.md` |
| US-09 | Compare years and programmes | Done | as above |
| US-10 | Print and export reports | Done (print or save as PDF; CSV per section) | as above |
| US-11 | Send reminders to targeted groups, with templates and read receipts | Done | `sprint-03/US-11-12-messaging.md` |
| US-12 | Students read messages in an inbox with unread badges | Done (web and mobile) | as above |
| US-19 | Schedule a message for later, and cancel it | Done | `sprint-03/remaining-web-features.md` |
| US-20 | Select students in the register and message them | Done | as above |
| US-21 | Keep staff-only notes on a student and see their message history | Done | `sprint-03/US-06-student-search.md` |
| US-22 | Export a student's audit as PDF | Done (browser print to PDF, audit-logged) | as above |
| US-23 | Import students and course records from CSV with preview and undo | Done | `sprint-03/data-management-imports.md` |
| US-24 | Create and edit single student and course records | Done | `sprint-03/manual-records.md` |
| US-25 | Set each course's pass mark (D+ or C) with an audit trail | Done | `sprint-03/course-pass-marks.md` |
| US-26 | Adjust standing thresholds | Done | `sprint-03/settings.md` |
| US-27 | Create administrators and reset passwords | Done | as above |
| US-28 | Browse the audit log | Done | as above |
| US-29 | See credits remaining and projected graduation for current cohorts | Done | `sprint-03/remaining-web-features.md` |
| US-30 | See messaging reach (delivered and read rates) | Done | as above |
| US-31 | Use a streamlined admin experience on mobile | Done (search, record, notes) | `sprint-04/mobile-app.md` |
| US-32 | Load and review the official 2028 curriculum | Blocked: `Degree_Audit_2028.xlsx` not provided; tooling exists | `controlled-curriculum-staging-runbook.md` |
| US-33 | Manage curriculum versions, grade scale and academic calendar in settings | Not started | `09-handoff/future-roadmap.md` |
| US-34 | Receive temporary passwords and messages by email | Blocked: needs SMTP | `09-handoff/known-issues.md` |

## Quality

| ID | Story | Status | Where |
|---|---|---|---|
| US-35 | Every main screen meets WCAG 2.2 AA (no serious or critical automated findings) | Done (manual screen-reader pass still due) | `sprint-04/accessibility-checks.md` |
| US-36 | Role-based access with automated proof that students cannot reach admin data | Done | `02-requirements/rbac-permission-matrix.md` |
