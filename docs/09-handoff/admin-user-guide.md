# Administrator guide

For Registry staff. Every action that reads or changes student data is recorded in the audit log under your staff ID.

## Signing in

Use your staff ID (for example `STF-0001`). New admins get a temporary password and must change it at first sign-in. **Settings → Change your password** changes yours at any time.

## Student lookup

- Search by **ID** (type the start) or **name** (any part, each word). If nothing matches exactly, close matches for a typo are offered under "Did you mean…".
- With the search box empty, your recently opened students are listed (kept in this browser only).
- A record shows the student's details, standing, the full requirement tree, every course and attempt, **staff notes** (visible to admins only, cannot be edited after saving) and the **messages** they received.
- **Print or save audit PDF** prints the full audit. Choose "Save as PDF" in the print dialog. Each export is logged.
- **Issue temporary password** gives the student a one-time password. Share it privately.
- **Edit record** changes details and course records for real students. Synthetic demonstration records can't be edited.

## Imports

Use this for bulk loads from CSV: **students** first, then **course records** (one row per attempt, oldest first).
1. Download the template.
2. Choose your file. You'll see what would be created or updated, and every problem with its row and column. Nothing is written yet.
3. Fix the problems and choose the file again, then **Apply**. The whole file is applied, or none of it is.
4. **Undo this import** restores exactly what was there before (latest import first).

New students' accounts stay locked until you issue a temporary password. To add **one** student without a file, use **Add one student** on the same page.

## Register

A table of every student with passed credits, credits in progress, failures not yet retaken and standing. Filter by programme, year group, standing or "needs attention"; sort by any column; **Download CSV**. Tick students (across pages) and choose **Message selected**.

## Messages

Write a message, or start from a template, then choose who receives it: all students, a programme, a year group, a standing (for example everyone Critical) or specific IDs. The recipient count updates as you go. Choose **Send later** to schedule it up to 180 days ahead; you can cancel it until it goes out. Each sent message shows how many students have read it.

## Reports

Standing now, graduation outcomes for past year groups (with reasons when requirements were not met), progress and outlook for current year groups (credits still to complete, projected graduation), programme comparison, course pass rates and grades, and messaging reach. Filter by programme and year group. **Print or save PDF** prints the whole page, and each section has its own CSV.

## Curriculum

Lists every imported curriculum version (programme, track, version, status, validation issues). **View** shows a version's full requirements: required courses by category with credits and pass marks, elective slots with their allowed courses (African Studies ones marked), totals and the source workbook.

A **draft** becomes the curriculum real students are assessed against only when a Registry reviewer marks it reviewed. Enter the evidence of Registry approval (for example the memo reference), confirm you have checked the requirements, and choose **Mark as reviewed**. Each review is logged. Review needs to be switched on for the deployment, and your account must be on the reviewer list; the page says when either is missing.

## Settings

| Section | What it does |
|---|---|
| Standing thresholds | Normal load, maximum load, and how many failed courses make standing critical. Applies everywhere at once |
| Course pass marks | Set a course to **C** (or record a confirmed **D+**), citing the Registry source. Applies at once to every audit, the register and reports |
| Administrators | List and create admin accounts |
| Audit log | The latest 100 entries, filtered by activity |

## Things to remember

- Results are **advisory**. The tracker never certifies graduation.
- Real students get a standing only once their programme's curriculum is Registry-reviewed. Until then they show "Not determined".
- The mobile app offers admins search, records and notes; use the web for everything else.
