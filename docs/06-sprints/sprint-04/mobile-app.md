# Mobile app (Flutter) — Sprint 04

Master build prompt §2 (mobile design), §5 (student features on mobile), §6 (streamlined admin) and §9 (mobile architecture).

## Delivered

| Area | What |
|---|---|
| Sign-in | One ID field with the role decided by the server, a generic error for wrong credentials, and a forced change of a temporary password |
| Student | Status (animated progress ring, standing with icon and text, credits, expected graduation, next three steps), requirements (expandable groups, filter by state, search), path to graduation (timeline), courses by term with pass/fail against each course's pass mark and retake history, inbox (unread badge, read on open, mark all read), profile (details, change password, sign out) |
| Admin | Search by ID or name with close matches, and a student record (status, requirements, courses, staff notes) |
| Platform | Refresh token in the Keychain or Android Keystore, single shared refresh, offline cache with banner, Android backup off, light and dark themes, large collapsing titles, floating blurred tab bar with haptics, reduced-motion support |
| Biometric unlock | Optional, off by default. Asks at launch and after a minute or more in the background, with the passcode as a fallback. Turning it on needs a passing check, signing out clears it, and "Sign out instead" is always available. Android uses `FlutterFragmentActivity`; iOS has the Face ID permission text |
| CI | `mobile-ci.yml`: format, analyze (very_good_analysis), test, Android APK artifact; iOS build without signing when started by hand |

## Verification in this sprint

- `flutter analyze`: no issues. `flutter test`: 32 tests (API client token handling, models, role routing, app lock, whole-app widget journeys including offline mode).
- **Visual check:** a throwaway web build of the same code, run against the local demo API at phone size (Pixel 7). It caught two layout bugs, both fixed: the large title was hidden, and filtered requirement groups stayed collapsed. It also caught an accessibility bug: the progress ring's label was merged into its card.
- **Android build:** not run in the development container, because installing the Android SDK means accepting Google's SDK licence, which only the repository owner should do. CI builds the APK on GitHub's runners, where the SDK is preinstalled.

## Deviations from the prompt, and why

- **No `freezed` or `build_runner`:** the models are a few hand-written classes, tested against API-shaped fixtures, which keeps the build simple.
- **No push notifications yet:** Firebase Cloud Messaging needs a Firebase project and config files.
- **Two lint rules relaxed:** line length is 100 to match the formatter, and the new Dart 3.13 constructor shorthand isn't required. Both are recorded in `analysis_options.yaml`.
