import 'dart:async';

import 'package:ashesi_graduation_tracker/core/api/api_client.dart';
import 'package:ashesi_graduation_tracker/core/api/api_error.dart';
import 'package:ashesi_graduation_tracker/core/providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The signed-in account, or null when signed out.
///
/// When the server cannot be reached at launch but a session is stored, the
/// app opens offline with the last known role so cached data can be shown.
class Session {
  const Session(this.info, {this.offline = false});

  final SessionInfo info;
  final bool offline;

  Role get role => info.role;
}

final sessionProvider = AsyncNotifierProvider<SessionController, Session?>(SessionController.new);

class SessionController extends AsyncNotifier<Session?> {
  static const _roleKey = 'session.role';

  ApiClient get _api => ref.read(apiClientProvider);

  @override
  Future<Session?> build() async {
    try {
      final info = await _api.restore();
      if (info == null) return null;
      await _rememberRole(info.role);
      return Session(info);
    } on ApiError catch (error) {
      final hasStoredSession = await ref.read(tokenStoreProvider).readRefreshCookie() != null;
      if (!error.isOffline || !hasStoredSession) return null;
      final role = await ref.read(cacheProvider).read(_roleKey);
      if (role == null) return null;
      return Session(
        SessionInfo(
          role: role == 'admin' ? Role.admin : Role.student,
          passwordChangeRequired: false,
        ),
        offline: true,
      );
    }
  }

  Future<void> signIn(String identifier, String password) async {
    final info = await _api.login(identifier.trim(), password);
    await _rememberRole(info.role);
    state = AsyncData(Session(info));
  }

  Future<void> changePassword(String current, String next) async {
    final info = await _api.changePassword(current, next);
    state = AsyncData(Session(info));
  }

  Future<void> signOut() async {
    await _api.logout();
    await ref.read(cacheProvider).clear();
    state = const AsyncData(null);
  }

  /// Retries the server after starting offline.
  Future<void> reconnect() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(build);
  }

  Future<void> _rememberRole(Role role) => ref.read(cacheProvider).write(_roleKey, role.name);
}
