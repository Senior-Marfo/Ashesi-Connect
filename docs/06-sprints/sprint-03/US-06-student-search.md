# US-06: Search student by ID — Sprint 03

**Owner role:** Registry administrator · **Story points:** 5 · **Commit prefix:** `feat(US-06)`

> As a Registry administrator, I want to find any student quickly, even with a mistyped ID or only part of a name, and see everything the office knows about them in one profile.

## Acceptance criteria

| # | Criterion | State |
|---|---|---|
| 1 | Typing the start of an ID lists matching students as the admin types. | Done |
| 2 | Typing any part of a name (case and accents ignored, every word must match) finds the student. | Done |
| 3 | When nothing matches exactly, near misses are offered and labelled "Close match". | Done |
| 4 | The last six opened records are offered when the search box is empty, and can be cleared. | Done |
| 5 | The profile shows identity, standing, the full audit, every course and attempt. | Done (earlier work) |
| 6 | Admins can add notes that students never see; each note records its author and time. | Done |
| 7 | The profile lists the messages the student received, with read times. | Done |
| 8 | The audit can be printed or saved as PDF, and each export is audit-logged. | Done |

## How matching works

`web-app/backend/src/search/student-search.ts`:

1. **ID prefix:** answered by an indexed prefix query. When it finds anything, those results are returned.
2. **Name:** each word typed must be the start of a word in the student's name (`ama boa` finds "Ama Boateng").
3. **Close matches,** used only when steps 1 and 2 find nothing:
   - an ID of six or more characters with one insertion, deletion, substitution or swap of adjacent characters;
   - name words with one typo (4–6 letters) or two (7 or more). Shorter fragments never fuzzy-match, because they would match almost everyone.

Name and close-match searches scan every student record (about 600 synthetic students today). If the roster grows by orders of magnitude, move them to a MongoDB text or Atlas Search index.

Search input may contain letters, digits, spaces, hyphens, apostrophes and full stops. Anything else is refused with `400`.

## Notes, history and export

- Notes are append-only (no edit or delete), up to 2,000 characters, stored in `studentnotes` and logged as `ADMIN_STUDENT_NOTE_ADDED`. No student route returns them, and a test checks this.
- Message history reuses the inbox receipts, so delivery and read times match what the student sees.
- **Print or save audit PDF** first records `ADMIN_AUDIT_EXPORTED`, expands the requirement tree, then opens the browser's print dialog. Search, actions, the note form and the curriculum catalogue are hidden in print, and a printed line states the time and that the audit is advisory. If the export cannot be recorded, printing does not start. A server-generated PDF is not built yet.
- Recently opened records are stored only in this browser's `localStorage` (ID and name only). Private windows still work, without the history.

## Evidence

- Unit tests: edit distance; ranking of ID, name and close matches; short fragments not fuzzy-matching; the result limit.
- API tests: ID, name and typo search through HTTP; rejected input; notes (author, ordering, validation, audit entry, not visible to students); message history read state; export logging; RBAC `401`/`403` for the four new routes.
- Repository contract test for notes, also run against MongoDB in CI.
- Component tests for the staff panel, and unit tests for the recent-records store.
- Playwright journey on desktop and phone: misspelt-name search → add a note → message history → audit print → recently opened after reload.
