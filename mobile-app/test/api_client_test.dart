import 'package:ashesi_graduation_tracker/core/api/api_client.dart';
import 'package:ashesi_graduation_tracker/core/api/api_error.dart';
import 'package:ashesi_graduation_tracker/core/api/token_store.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fake_server.dart';

void main() {
  late FakeServer server;
  late MemoryTokenStore store;
  late ApiClient api;

  setUp(() {
    server = FakeServer();
    store = MemoryTokenStore();
    api = ApiClient(baseUrl: 'https://example.test', tokens: store, adapter: server);
  });

  test('signing in keeps the refresh cookie and returns the server-assigned role', () async {
    server.on(
      'POST /api/v1/auth/login',
      (_) => FakeResponse(200, tokens(role: 'ADMIN'), [refreshCookie('r1')]),
    );
    final session = await api.login('STF-0001', 'secret');
    expect(session.role, Role.admin);
    expect(store.cookie, 'agt_refresh=r1');
    expect(server.requests.single.data, {'identifier': 'STF-0001', 'password': 'secret'});
  });

  test('a wrong password surfaces the server error code', () async {
    server.on(
      'POST /api/v1/auth/login',
      (_) => const FakeResponse(401, {'error': 'INVALID_CREDENTIALS'}),
    );
    expect(
      () => api.login('20280001', 'wrong'),
      throwsA(isA<ApiError>().having((error) => error.code, 'code', 'INVALID_CREDENTIALS')),
    );
  });

  test(
    'an expired access token is refreshed once with the stored cookie and the request retried',
    () async {
      store.cookie = 'agt_refresh=r1';
      var refreshes = 0;
      server
        ..on('POST /api/v1/auth/refresh', (request) {
          refreshes++;
          expect(request.headers['cookie'], 'agt_refresh=r$refreshes');
          expect(request.headers['x-requested-with'], isNotNull);
          return FakeResponse(200, tokens(token: 'access-${refreshes + 1}'), [
            refreshCookie('r${refreshes + 1}'),
          ]);
        })
        ..on('GET /api/v1/students/me', (request) {
          final valid = request.headers['authorization'] == 'Bearer access-3';
          return valid
              ? const FakeResponse(200, {'student': <String, Object?>{}})
              : const FakeResponse(401, {'error': 'UNAUTHENTICATED'});
        });

      await api.restore();
      expect(store.cookie, 'agt_refresh=r2');
      // access-2 is now rejected, so the client refreshes again (rotating the cookie) and retries.
      final json = await api.getJson('/students/me');
      expect(json, containsPair('student', isA<Map<String, dynamic>>()));
      expect(refreshes, 2);
      expect(store.cookie, 'agt_refresh=r3');
    },
  );

  test('concurrent requests share a single refresh, so the rotating token is used once', () async {
    store.cookie = 'agt_refresh=r1';
    server
      ..on('POST /api/v1/auth/refresh', (_) => FakeResponse(200, tokens(), [refreshCookie('r2')]))
      ..on(
        'GET /api/v1/students/me/messages',
        (_) => const FakeResponse(200, {'messages': <Object?>[]}),
      );
    await Future.wait([api.getJson('/students/me/messages'), api.getJson('/students/me/messages')]);
    expect(server.count('POST /api/v1/auth/refresh'), 1);
  });

  test('a rejected refresh clears the stored session', () async {
    store.cookie = 'agt_refresh=stale';
    server
      ..on(
        'POST /api/v1/auth/refresh',
        (_) => const FakeResponse(401, {'error': 'INVALID_REFRESH_TOKEN'}),
      )
      ..on('GET /api/v1/students/me', (_) => const FakeResponse(401, {'error': 'UNAUTHENTICATED'}));
    expect(await api.restore(), isNull);
    expect(store.cookie, isNull);
    expect(
      () => api.getJson('/students/me'),
      throwsA(isA<ApiError>().having((error) => error.code, 'code', 'SESSION_EXPIRED')),
    );
  });

  test('restoring without a stored cookie makes no request', () async {
    expect(await api.restore(), isNull);
    expect(server.requests, isEmpty);
  });

  test('network failures are reported as offline', () async {
    store.cookie = 'agt_refresh=r1';
    server.offline = true;
    expect(
      api.restore,
      throwsA(isA<ApiError>().having((error) => error.isOffline, 'isOffline', true)),
    );
    expect(store.cookie, 'agt_refresh=r1');
  });

  test('signing out clears the session even when the server is unreachable', () async {
    store.cookie = 'agt_refresh=r1';
    server.offline = true;
    await api.logout();
    expect(store.cookie, isNull);
  });
}
