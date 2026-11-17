# Known issues and limits

| Area | Issue | Impact | Next step |
|---|---|---|---|
| Curriculum | The official `Degree_Audit_2028.xlsx` has not been provided, so no Registry-reviewed curriculum exists | Real students show standing "Not determined"; only synthetic students get a full audit | Registry provides the workbook; import, validate and review it (`docs/controlled-curriculum-staging-runbook.md`) |
| Pass marks | No course is set to C | All courses pass at D+ until the Registry confirms which need a C | Enter confirmed C courses under Settings → Course pass marks |
| Elective default | The audit engine passes electives at D when nothing sets a pass mark, while the register and reports use D+ | A D in such an elective counts in the audit but appears as a failure in the register | Registry decides; see `docs/00-governance/requirements-discrepancies.md` |
| Programme totals | Printed CS and ME totals disagree with their components | Totals may be off by one credit for those programmes | Registry confirmation |
| Email | No SMTP: temporary passwords and messages are not emailed | Admins share temporary passwords in person; messages are in-app only | Configure SMTP |
| Push notifications | Not built (needs a Firebase project) | Mobile users see messages when they open the app | Create a Firebase project and add the config |
| Mobile signing | CI APKs use the debug key; the iOS build is unsigned | Fine for testing; not for the stores | Follow `docs/08-deployment/mobile-release-guide.md` |
| PDF export | Uses the browser's print dialog, not a server-generated PDF | Layout depends on the browser | Server-side PDF if exact layout matters |
| Hosting | Render free tier sleeps when idle | The first request after a while can take about a minute | Paid instance |
| Search scale | Name and typo search scans all students | Fine for thousands of students; slower beyond that | Atlas Search or a text index |
| Admin security | Password-only sign-in for admins | Weaker than multi-factor | Add MFA before real data |
| Design | The Figma file was not created programmatically | Design is documented in code and docs only | Build the Figma file by hand if needed |
| Live smoke test | Removed at the owner's request | Post-deploy checks are manual | Use the [UAT script](../07-testing/uat-script.md) |
