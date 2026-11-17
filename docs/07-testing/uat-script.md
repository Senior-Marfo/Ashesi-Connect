# User acceptance test script

For Registry staff checking a release on the live site or a staging copy. It uses synthetic records only. Tick each step; note the step number for anything that fails.

**You need:** an admin account, and a synthetic student account (for example `92800001` with the synthetic password from the seeding workflow).

## Student (phone and desktop)

1. Sign in with the student ID. The status screen shows the name, a progress ring, a standing (with icon and words), credits and expected graduation.
2. **Requirements:** groups open and close; the "Below pass mark" filter shows only failed courses with their pass mark.
3. **Remaining:** the path to graduation lists this term, items to resolve, and what's left before graduation.
4. **Courses:** courses grouped by term, with grades and Passed / Below pass mark; retakes show earlier attempts.
5. **Inbox:** the unread badge matches; opening a message clears its badge.
6. **Profile:** details are correct; Change password works and signs out other devices.
7. Type an admin address (`/admin/`) in the browser: you are sent back to the student screens.

## Administrator

8. **Student lookup:** search an ID prefix, then a name, then a misspelt name ("Did you mean…"). Open a record.
9. On the record: add a staff note; check the message history; **Print or save audit PDF** shows the full requirement tree.
10. **Edit record** (on a real test record, not a synthetic one): change the track; add a course with a retake; remove it again. Synthetic records say they cannot be edited.
11. **Imports:** download the template, import one student with a deliberate error (the problem is shown and nothing is written), fix it, apply, then **Undo this import**.
12. **Register:** filter by programme and standing; sort; download CSV; select several students and **Message selected**.
13. **Messages:** schedule a message for tomorrow, check it shows as scheduled, cancel it. Send one now to a test student and confirm it arrives.
14. **Reports:** every section loads; Print shows a clean page; each CSV downloads.
15. **Settings:** set a C pass mark on a course a synthetic student passed with D+; the student's status updates. Remove it again. Change a standing threshold and restore it. Check the audit log shows all of these with your staff ID.

## Mobile app (Android APK from Mobile app CI, or a store build)

16. Sign in as the student: all five tabs load. Turn on airplane mode and reopen the app: the last status shows with an "Offline" banner.
17. Turn on **Unlock and password → Unlock with Face ID or fingerprint**; close the app for over a minute and reopen it: it asks to unlock.
18. Sign in as the admin: search, open a student and add a note.

**Pass:** every step works on the release. Record the date, build (commit or app version), tester and results in the sprint folder.
