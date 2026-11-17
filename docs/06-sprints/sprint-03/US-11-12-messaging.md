# US-11 and US-12: Messages and inbox — Sprint 03

## US-11: Send reminders and notifications (admin, `/admin/messages/`)

- **Composing.** A message has a title (up to 120 characters), a body (up to 5,000) and a priority (normal or high). Four templates give a starting point: audit review due, required course retake, African Studies elective missing, and incomplete course to resolve.
- **Audience.** All students, a programme, a year group, students with a given **standing** (critical / at risk / on track, from the same assessment as the register), or a list of student IDs. The recipient count updates as the audience changes (`POST /api/v1/admin/messages/preview`). Unknown IDs are listed and skipped. An audience with no recipients is refused (`422 NO_RECIPIENTS`). Sending asks for confirmation.
- **Delivery and receipts.** Sending stores the message and one receipt per recipient, which is delivery to the in-app inbox. The sent list shows each message's audience, time and **read receipts** (read of recipients).
- **Audit and access.** Each send is logged as `ADMIN_MESSAGE_SENT` with the audience type, recipient count and priority. Sending requires `message:send` (admins).

## US-12: Inbox (student, `/student/inbox/`)

- **Inbox.** Messages appear newest first, unread ones marked with a dot and bold title, high priority tagged. Opening a message marks it read.
- **Unread badge** on the Inbox link in the student navigation. It refreshes once the read has been recorded. **Mark all as read** clears everything.
- **Isolation.** The student ID always comes from the access token, so a student can't read or mark anyone else's messages (`message:read:own`).

## API

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/admin/messages/templates` | `message:send` |
| POST | `/api/v1/admin/messages/preview` | `message:send` |
| POST | `/api/v1/admin/messages` | `message:send` |
| GET | `/api/v1/admin/messages` | `message:send`; includes `recipientCount` and `readCount` |
| GET | `/api/v1/students/me/messages` | `message:read:own` |
| GET | `/api/v1/students/me/messages/unread-count` | `message:read:own` |
| POST | `/api/v1/students/me/messages/:id/read` | `message:read:own` |
| POST | `/api/v1/students/me/messages/read-all` | `message:read:own` |

## Not yet implemented

- **Real-time delivery.** No Socket.IO or server-sent events yet; the inbox and badge refresh on page load.
- **Mobile push notifications.** Need the Flutter app and Firebase credentials.
- **Email copies.** Need SMTP credentials.
- **Scheduled sending, attachments and rich-text bodies.** Bodies are plain text with line breaks kept.

## Evidence

- **Repository contract:** delivery per recipient, ordering, read tracking, mark-all and sent statistics, run in-memory and against MongoDB in CI.
- **API tests:** programme targeting with isolation, read receipts and reach, cross-student protection, unknown IDs and empty audiences, standing targeting, validation, templates, and role separation. The admin message routes are in the RBAC test list.
- **Playwright journey (desktop and phone):** an admin applies a template and targets one ID plus an unknown one; the student sees the badge, opens the message, and the badge clears.

Also fixed in this increment: on phones the navigation now scrolls sideways and keeps the current section in view. Before, the fifth student item ran off the screen.
