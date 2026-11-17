import 'package:ashesi_graduation_tracker/core/api/api_client.dart';
import 'package:ashesi_graduation_tracker/core/api/token_store.dart';
import 'package:ashesi_graduation_tracker/core/cache.dart';
import 'package:ashesi_graduation_tracker/core/config.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final tokenStoreProvider = Provider<TokenStore>((ref) => SecureTokenStore());
final cacheProvider = Provider<Cache>((ref) => PrefsCache());
final apiClientProvider = Provider<ApiClient>(
  (ref) => ApiClient(baseUrl: AppConfig.apiBaseUrl, tokens: ref.watch(tokenStoreProvider)),
);
