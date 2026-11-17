# Mobile release guide

## Android

1. **Test build:** every push under `mobile-app/` runs **Mobile app CI**. Download `graduation-tracker-android` from the run's artifacts and install `app-release.apk` on a phone (allow installs from that source). It is signed with the debug key, which is fine for testing but not for the Play Store.
2. **Store build:** create an upload keystore once (`keytool -genkey -v -keystore upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload`). Keep it and its passwords out of the repository. Add `android/key.properties` locally, or CI secrets, and point the `release` signing config in `android/app/build.gradle.kts` at it. Then run `flutter build appbundle --release --dart-define=API_BASE_URL=https://ashesi-graduation-tracker.onrender.com` and upload the `.aab` to Play Console.
3. The application ID is `io.github.seniormarfo.ashesi_graduation_tracker`. Change it before the first store upload if a university-owned ID is wanted, because it cannot be changed afterwards.

## iOS

1. Start **Mobile app CI** by hand (**Run workflow**). The `ios` job checks that the app builds without code signing.
2. To ship, on a Mac with Xcode: open `mobile-app/ios/Runner.xcworkspace`, set the team and bundle ID, then run `flutter build ipa --dart-define=API_BASE_URL=…` and upload through Xcode or Transporter. This needs an Apple Developer account.

## Configuration

| Setting | How | Default |
|---|---|---|
| API origin | `--dart-define=API_BASE_URL=…` | `https://ashesi-graduation-tracker.onrender.com` |

The API needs no change for the app. Native requests carry no browser `Origin`, so CORS does not apply. The app keeps the refresh cookie itself and sends the `x-requested-with` header that the refresh and logout routes require.
