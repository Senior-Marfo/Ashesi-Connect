# US-08 to US-10: Reports, year comparison, print and export — Sprint 03

The reports page is at `/admin/reports/` and needs the new `report:read` permission (admins). Every view and export is audit-logged as `ADMIN_REPORTS_VIEWED`. It can be filtered by programme and year group.

| Section | Story | Content |
|---|---|---|
| Standing now | US-07 / US-08 | One segmented bar of critical / at risk / on track / not determined, with the share printed where it fits and a legend giving each level's icon, label and count. |
| Graduation outcomes by year group | US-08, US-09 | For year groups whose graduation term has ended: the share of assessed students who met every requirement (an advisory graduation-rate proxy), one row per year group for the year-on-year comparison. Below it, the ranked reasons requirements were not met: failed course not retaken, incomplete, required course not taken, capstone outstanding, electives short, total credits short. |
| Progress of current year groups | US-08 | Average % complete and the standing split for each year group still studying. |
| Programme comparison | US-08 | Students, average passed credits, completion in graduated year groups, and the standing split for each programme. |
| Courses | US-08 | The courses with the lowest first-attempt pass rate (at least 5 students), the most-retaken courses, and the grade distribution for any course. |

## Print and export (US-10)

- **Print or save PDF** uses the browser's print dialog with a print stylesheet: navigation and controls hidden, sections kept on one page, colours preserved.
- Each table has a **CSV** download: `GET /api/v1/admin/reports/{cohorts|programmes|courses}.csv`, with the same filters. The files carry a UTF-8 byte order mark and protection against spreadsheet formulas.

## Charts

- These follow the data-visualisation method in the design system. Rates and averages per row are **meter lists** in a single hue with the figure printed.
- Grade distributions are **columns** with the value printed on each bar.
- The standing split uses the validated status palette:
  - Critical `#d03b3b`, warning `#fab219` and good `#0ca30c` pass the colour-blind (CVD) and normal-vision separation checks for adjacent fills.
  - Warning is below 3:1 contrast on the light background by design, so every status always appears with its icon and label in the legend.
  - The previous badge colours failed the adjacency check and are kept for badge text only.
- Every chart has a text equivalent (`role="img"` with an `aria-label`, or the figures printed beside it).

## Method and limits

- Outcomes come from the same advisory assessment as the student screens, so real students count as "assessed" only where a Registry-reviewed curriculum exists. The figures are not official graduation statistics, and the page says so.
- Course pass rates use the provisional D+ pass mark until the Registry confirms per-course thresholds.
- Reports are computed per request by assessing every student in the selection. That suits hundreds to low thousands of students. For larger cohorts, store report snapshots (a `reportSnapshots` collection in the master plan) or precompute assessments when records change.
