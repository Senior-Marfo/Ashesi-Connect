/// Build-time configuration, set with `--dart-define`.
abstract final class AppConfig {
  /// Origin of the Graduation Tracker API, without a trailing slash.
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://ashesi-graduation-tracker.onrender.com',
  );
}
