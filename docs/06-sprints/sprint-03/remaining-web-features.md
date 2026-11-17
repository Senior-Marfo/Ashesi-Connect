# Scheduling, bulk messaging, outlook reports and student profile — Sprint 03

These close the remaining web items in the master build prompt's §5, §6.3, §7 and §8.

| Item | Prompt | What was built |
|---|---|---|
| Schedule messages for later | §8 | `sendAt` on `POST /admin/messages`, 1 minute to 180 days ahead. Receipts carry the delivery time, so inboxes and unread counts include a message only from then on. Admins see "Scheduled for…" and can cancel until delivery (`DELETE /admin/messages/:id`, `ADMIN_MESSAGE_CANCELLED`). |
| Bulk select to message | §6.3 | Register checkboxes; the selection survives paging and filters. **Message selected** opens Messages with those IDs filled in (up to 500, the API limit). |
| Credits-remaining distribution and projected graduation by term | §7 | Students in current year groups banded by credits still to complete after courses in progress. Each year group's planned term split into on plan (green), at risk (yellow) and likely later (red). |
| Messaging reach report | §7 | Messages delivered, deliveries and read rate, with scheduled messages counted once delivered. |
| Profile and security | §5.6 | Student **Profile** page (programme, year group, track, expected graduation, curriculum) with **Change password**. Admins get the same link under Settings → Your account. Before this, the voluntary password change was only reachable by typing its address. |

## Decisions

- **Scheduled recipients are fixed at creation.** A message for "all critical students" scheduled for next week reaches the students who are critical today. This is shown in the compose form.
- **Messaging reach ignores the report filters,** because messages target their own audiences. The section says so.
- **The projected term is the planned graduation term,** and red standing means "likely later". The tracker does not predict a specific later term, because that would need a course-offering timetable it doesn't have.

## Evidence

- Repository contract test: scheduled messages hidden until due, cancellable only before delivery (also on MongoDB in CI).
- API tests: schedule validation (too soon, past, over 180 days, malformed), delivery when the clock passes, cancel refused after delivery, audit entries. `buildTestApp` now accepts a clock.
- Report tests for credit bands and projections; an API test for messaging reach with one delivered and one scheduled message.
- Playwright: select BA students in the register, untick one, schedule a message to the other six and cancel it; the reports outlook and reach sections; the student profile and password link.
