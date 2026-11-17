/// A failed API call, with the server's error code and readable message when it sent one.
class ApiError implements Exception {
  const ApiError(this.status, this.code, [this.message]);

  /// HTTP status, or 0 when the server could not be reached.
  final int status;
  final String code;
  final String? message;

  bool get isOffline => status == 0;

  /// Text that can be shown to the user.
  String describe(String fallback) => isOffline
      ? 'You appear to be offline. Check your connection and try again.'
      : (message ?? fallback);

  @override
  String toString() => 'ApiError($status, $code${message == null ? '' : ', $message'})';
}
