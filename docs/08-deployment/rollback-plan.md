# Rollback plan

## Web and API

1. On Render, open the service's **Events** page, choose the last good deploy and select **Rollback**. It takes about a minute.
2. Every collection is additive, so an older build runs against the newer database. The newest additions (`studentnotes`, `passmarks`, scheduled message receipts) are ignored by older builds.
   - Scheduled messages not yet delivered would show immediately in an older build. Cancel any scheduled messages before rolling back to a build older than November 17, 2026.
3. Revert the merge on GitHub so `main` matches what is running; otherwise the next push deploys the bad version again.

## Data

| Change | How to undo |
|---|---|
| A CSV import | **Imports → Undo this import** (latest batch only; undo newer batches first) |
| A manual record edit | The audit log shows the previous values (`ADMIN_STUDENT_UPDATED`, `ADMIN_COURSE_RECORD_UPDATED`); re-enter them in **Edit record** |
| A pass mark | **Settings → Course pass marks**: change or remove it; the audit log shows the previous value |
| Standing thresholds | **Settings**: the audit log shows the previous values |
| Synthetic cohort | **Load or remove synthetic student records** with mode `remove` |
| Anything else, or bulk damage | Restore the Atlas backup or `mongodump` taken before the change |

## Mobile

Store releases cannot be pulled back from phones. Publish a fixed build with a higher version number, or halt a staged rollout in Play Console or App Store Connect. A test APK from CI can simply be uninstalled.
