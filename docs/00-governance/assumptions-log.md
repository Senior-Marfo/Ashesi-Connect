# Assumptions and blockers

- The source Degree_Audit_2028.xlsx workbook is unavailable in the attached project sources; graduation requirements cannot be verified yet.
- Minimum per-course passing grade D+ is a provisional default. The official catalogue must confirm any C thresholds, including programme-specific major courses.
- **No course is set to C.** The build prompt asks for a seed file of C courses (`catalogue-pass-thresholds.json`). It is deliberately not provided: no Registry source names those courses, and guessing would mark real students as failing. Admins enter confirmed C pass marks under **Settings → Course pass marks**, citing the source.
- A catalogue pass mark overrides the pass mark in any curriculum, raising or lowering it, because it is the Registry's latest decision on that course.
- Elective pools with no pass mark of their own still pass a D in the audit engine, as implemented earlier, while the register and reports treat a D as a fail. Left unchanged so the live seeded records keep their standings. It is listed in `requirements-discrepancies.md` for the Registry. Setting a pass mark for an elective course removes the gap for that course.
- Demo courses and records are illustrative only and are not verified institution data.
- The eligibility TypeScript starter covers only required courses, grades and retakes; remaining categories, electives, capstones, IAP and track calculations are not yet complete.
- The web app is deployed on Render with MongoDB Atlas (https://ashesi-graduation-tracker.onrender.com). SMTP and Firebase credentials are not configured.
- Ashesi Graduation Tracker is an independent prototype, not an official Ashesi University service.
