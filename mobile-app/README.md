# Graduation Tracker mobile app (Flutter)

> Independent prototype, not an official Ashesi University service.

Android and iOS app for the Graduation Tracker API (`web-app/backend`). Students see their status, requirements, path to graduation, courses and inbox. Admins get a streamlined student search and record view, with staff notes.

## Run it

```sh
cd mobile-app
flutter pub get
flutter run --dart-define=API_BASE_URL=https://ashesi-graduation-tracker.onrender.com
```

`API_BASE_URL` defaults to the live service. To use the local demo API, run `npm run dev:demo` in `web-app/backend` (port 3000), then pass `http://10.0.2.2:3000` on the Android emulator or `http://localhost:3000` on the iOS simulator. Android release builds then need cleartext HTTP allowed, so use HTTPS wherever you can.

Flutter 3.47.9 (Dart 3.13), the version pinned in CI.

## Checks

```sh
dart format --output=none --set-exit-if-changed lib test
flutter analyze        # very_good_analysis, with the two exceptions noted in analysis_options.yaml
flutter test           # API client, models, role routing and whole-app widget tests
flutter build apk --release
```

CI (`.github/workflows/mobile-ci.yml`) runs all of these on every change under `mobile-app/` and uploads the APK as the `graduation-tracker-android` artifact. Start the workflow by hand to also build iOS without code signing.

## How it is put together

| Folder | Contents |
|---|---|
| `lib/core/` | Build configuration, API client, secure token store, offline cache, theme tokens |
| `lib/models/` | Typed models of the API's JSON, plus wording shared with the web client |
| `lib/features/auth/` | Session controller, sign-in and password change |
| `lib/features/student/` | Status, requirements, path to graduation, courses, inbox, profile |
| `lib/features/admin/` | Search (ID, name, close matches) and the student record with staff notes |
| `lib/widgets/` | Progress ring, standing badges, large-title page, floating glass tab bar |
| `lib/app/` | App, router with role guards, splash, student tab shell |

- **Sign-in and roles:** one ID field. The server decides the role, and the router only opens that role's screens. A temporary password must be changed before anything else.
- **Tokens:** the 15-minute access token is kept in memory only. The rotating refresh token, an httpOnly cookie on the web, is stored in the platform keystore (Keychain or Android Keystore) and sent back as a cookie. A burst of expired requests triggers a single refresh. Android cloud backup is off, so the stored session never leaves the device.
- **Offline:** the last loaded status and course record are cached on the device. When the server can't be reached they are shown with an "Offline" banner. Signing out clears them.
- **Design:** colour, spacing and type tokens mirror `web-app/frontend/app/globals.css`, in light and dark themes. Standing always has an icon and text as well as colour. Large titles collapse as you scroll, the floating tab bar blurs what is behind it and gives a light haptic tick, and the progress ring stays still when the phone asks for reduced motion.

## Not built yet

- **Push notifications (FCM):** they need a Firebase project and its config files. The inbox works through the API and shows an unread badge.
- **Biometric unlock:** it needs `local_auth` and a decision on lock timing.
- **Store signing:** CI APKs are signed with the debug key. See `docs/08-deployment/mobile-release-guide.md`.
- **Code generation (freezed):** skipped. The models are small hand-written classes, tested against API-shaped fixtures.
