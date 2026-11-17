import 'package:shared_preferences/shared_preferences.dart';

/// Small on-device cache for offline viewing. Cleared when the user signs out.
abstract interface class Cache {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> clear();
}

class PrefsCache implements Cache {
  PrefsCache([SharedPreferencesAsync? prefs]) : _prefs = prefs ?? SharedPreferencesAsync();

  static const _prefix = 'agt.cache.';
  final SharedPreferencesAsync _prefs;

  @override
  Future<String?> read(String key) => _prefs.getString('$_prefix$key');

  @override
  Future<void> write(String key, String value) => _prefs.setString('$_prefix$key', value);

  @override
  Future<void> clear() async {
    final keys = await _prefs.getKeys();
    await _prefs.clear(allowList: keys.where((key) => key.startsWith(_prefix)).toSet());
  }
}

class MemoryCache implements Cache {
  final values = <String, String>{};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async => values[key] = value;

  @override
  Future<void> clear() async => values.clear();
}
