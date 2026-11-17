# Automated accessibility checks — Sprint 04

Master build prompt §2 and §10, and the definition of done: "no critical accessibility … findings", WCAG 2.2 AA.

## What runs

`web-app/frontend/e2e/accessibility.spec.ts` runs axe-core (`@axe-core/playwright`) with the WCAG 2.0, 2.1 and 2.2 A/AA rules. It covers the sign-in screen, every student screen (status, requirements, remaining, courses, inbox, profile) and every admin screen (lookup with a record open, register, reports, messages, imports, settings), at desktop and phone sizes. Any **serious** or **critical** finding fails CI, and the message names the rule and the elements.

## What it found and how it was fixed

| Finding | Where | Fix |
|---|---|---|
| Colour contrast 4.22:1 (needs 4.5:1) | Amber "In progress" chips | `--progress` darkened from `#9a6a00` to `#8a5d00` (5.13:1); the mobile token changed to match |
| Colour contrast 3.35:1 | Percentage inside the green "On track" bar segment | Near-black text on green (5.87:1); the chart colours are unchanged |
| Scrollable region not keyboard-reachable | Tables that scroll sideways on phones | Each table wrapper is a focusable, labelled region with a visible focus ring |
| Target size under 24px (WCAG 2.2) | C / D+ radio buttons in Course pass marks | Radio buttons are 24px everywhere |

## Not covered by automation

Screen-reader reading order and announcements, and zoom to 400% at narrow widths, still need a manual pass with VoiceOver or TalkBack before release.
