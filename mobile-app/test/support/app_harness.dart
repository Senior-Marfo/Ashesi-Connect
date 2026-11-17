import 'package:ashesi_graduation_tracker/app/app.dart';
import 'package:ashesi_graduation_tracker/core/api/api_client.dart';
import 'package:ashesi_graduation_tracker/core/api/token_store.dart';
import 'package:ashesi_graduation_tracker/core/cache.dart';
import 'package:ashesi_graduation_tracker/core/providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_server.dart';

/// The whole app against an in-memory server, token store and cache.
class AppHarness {
  final server = FakeServer();
  final tokens = MemoryTokenStore();
  final cache = MemoryCache();

  Future<void> pump(WidgetTester tester) async {
    tester.view
      ..physicalSize = const Size(1170, 2532)
      ..devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      ProviderScope(
        // A fresh container each time, so a second pump starts a new app session.
        key: UniqueKey(),
        overrides: [
          tokenStoreProvider.overrideWithValue(tokens),
          cacheProvider.overrideWithValue(cache),
          apiClientProvider.overrideWithValue(
            ApiClient(baseUrl: 'https://example.test', tokens: tokens, adapter: server),
          ),
        ],
        child: const GraduationTrackerApp(),
      ),
    );
    await settle(tester);
  }
}

/// Lets network futures and animations finish; the progress ring animates for about a second.
Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 300));
  }
}
