# Degree audit 2028 workbook: verified discrepancies

`Degree_Audit_2028.xlsx` (SHA-256 `6c88df76001f55894927694f3395c7f3d87073267a1978502faf729d4742c354`, received 2026-11-17) was parsed by `web-app/backend/scripts/ingest-degree-audit.ts`. Every category, section and overall total was recomputed from its listed components for both maths tracks. Each finding below was then checked by hand against the sheet. The full report is [`../02-requirements/degree-audit-2028/reconciliation.md`](../02-requirements/degree-audit-2028/reconciliation.md).

**BA, ECON, MIS and EE reconcile exactly** on both tracks. LLB reconciles once its IAP courses are left out (see below).

| Programme | Finding | Listed components | Printed | Question for the Registry |
|---|---|---|---|---|
| CS | Required Major Classes (row 56) | 14.5: 14 courses plus "Intro to Modelling & Simulation *" at 0.5 | 14 | Is Modelling & Simulation a half-credit course, and is it required? |
| CS | Liberal Arts & Sciences Core (row 38) | 16.5: the printed category totals 5.5 + 3 + 4 + 1 + 0 + 1 + 2 | 17.5 (18.5 Pre-Calc) | Which category is short by 1 credit, or is the section total wrong? This confirms the difference the build prompt flagged |
| CS | Major section and overall | 18.5 major, 35 overall (with the figures above) | 18 major, 34.5 overall | Follows from the two rows above |
| CE | Total Credits – Major (row 65) | 20: 16 required + 3 electives + 1 capstone | 19 | Is the section total (and so the overall 37/38) one credit short, or is a component wrong? |
| ME | Total Credits – Major (row 64) | 19: 15 required + 3 electives + 1 capstone | 18 | With 19, LAS 18 + 19 = 37 matches the printed overall, so the printed 18 looks like the error. Confirms the difference the build prompt flagged |
| MT | Required Major Classes (row 57) | 15: 14 courses + two half-credit courses | 16 | Is a required course missing from the list, or is the printed 16 wrong? Major (20) and overall (38/39) depend on it |
| BE | Required Major Classes (row 57) | 14: 13 courses + two half-credit courses | 15 | Is a required course missing from the list, or is the printed 15 wrong? Major (19) and overall (37/38) depend on it |
| LLB | IAP (rows 74–77) | Four courses listed with no credits | No total; the overall 40.5 = 11.5 + 29 leaves them out | Do the IAP courses carry credits? They are kept as requirements but count 0 credits until confirmed |

## What the workbook does not say

- **Course codes.** The workbook names courses ("Data Structures and Algorithms") but gives no codes, while student records use codes such as `CS 212`. The Registry needs to complete [`curriculum-course-mapping.csv`](../02-requirements/degree-audit-2028/curriculum-course-mapping.csv), one row per course or course option, before a curriculum can be built.
- **Pass marks.** No course is marked as needing a C. The provisional D+ stays until the Registry says otherwise (the `minimum_grade` column in the mapping, or Settings → Course pass marks).
- **Elective lists.** Elective slots ("2 CS Electives", "at least 1 African studies") have no list of allowed courses. The mapping's `course_code` column for those rows takes the list.
- **Which maths option belongs to which track.** "Pre-Calculus 1 / Calculus 1" and "Calculus for Engineering / Calc 1" are split into one row per option, with a suggested track based on the printed track names, to confirm.
- **Conditional capstones.** "Capstone 1 (could be CS elective)" in BA, MIS and CS: whether and how it may count as a major elective.

# Pass-mark default for electives (for Registry confirmation)

- The audit engine passes an elective at **D** when neither the course nor its elective pool has a pass mark. The register, reports and course statistics treat a **D** as a fail (D+ default). The Registry should confirm the rule for electives. Until then, setting a pass mark for an elective under **Settings → Course pass marks** makes both sides agree for that course.
