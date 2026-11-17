import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Keeps the long-lived refresh cookie between app launches.
///
/// The web client relies on an httpOnly cookie; a native app has no cookie
/// jar, so it stores the cookie value in the platform keystore instead.
abstract interface class TokenStore {
  Future<String?> readRefreshCookie();
  Future<void> writeRefreshCookie(String cookie);
  Future<void> clear();
}

class SecureTokenStore implements TokenStore {
  SecureTokenStore([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  static const _key = 'agt.refresh-cookie';
  final FlutterSecureStorage _storage;

  @override
  Future<String?> readRefreshCookie() => _storage.read(key: _key);

  @override
  Future<void> writeRefreshCookie(String cookie) => _storage.write(key: _key, value: cookie);

  @override
  Future<void> clear() => _storage.delete(key: _key);
}

/// For tests and previews.
class MemoryTokenStore implements TokenStore {
  String? cookie;

  @override
  Future<String?> readRefreshCookie() async => cookie;

  @override
  Future<void> writeRefreshCookie(String value) async => cookie = value;

  @override
  Future<void> clear() async => cookie = null;
}
