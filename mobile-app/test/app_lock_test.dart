import 'package:ashesi_graduation_tracker/core/cache.dart';
import 'package:ashesi_graduation_tracker/core/providers.dart';
import 'package:ashesi_graduation_tracker/features/auth/app_lock.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/app_harness.dart';
import 'support/fake_server.dart';
import 'support/fixtures.dart';

AppHarness signedInStudent() {
  final app = AppHarness();
  app.tokens.cookie = 'agt_refresh=r1';
  app.server
    ..on('POST /api/v1/auth/refresh', (_) => FakeResponse(200, tokens(), [refreshCookie('r2')]))
    ..on('POST /api/v1/auth/logout', (_) => const FakeResponse(204))
    ..on('GET /api/v1/students/me/eligibility', (_) => FakeResponse(200, eligibilityJson()))
    ..on('GET /api/v1/students/me/messages', (_) => FakeResponse(200, inboxJson()));
  return app;
}

void main() {
  test('relocks only after a minute or more in the background', () async {
    final cache = MemoryCache()..values['biometric-unlock'] = 'on';
    final unlock = FakeUnlock();
    final container = ProviderContainer(
      overrides: [
        cacheProvider.overrideWithValue(cache),
        deviceUnlockProvider.overrideWithValue(unlock),
      ],
    );
    addTearDown(container.dispose);
    final lock = container.read(appLockProvider.notifier);
    expect((await container.read(appLockProvider.future)).locked, isTrue);
    expect(await lock.unlock(), isTrue);

    final away = DateTime(2026, 11, 17, 9);
    lock
      ..hiddenAt = away
      ..appShown(away.add(const Duration(seconds: 59)));
    expect(container.read(appLockProvider).value!.locked, isFalse);
    lock
      ..hiddenAt = away
      ..appShown(away.add(relockAfter));
    expect(container.read(appLockProvider).value!.locked, isTrue);
  });

  testWidgets('turning unlock on needs a passing check', (tester) async {
    final app = signedInStudent();
    await app.pump(tester);
    await tester.tap(find.text('Profile').last);
    await settle(tester);
    await tester.tap(find.text('Unlock and password'));
    await settle(tester);

    app.unlock.passes = false;
    await tester.tap(find.byType(Switch));
    await settle(tester);
    expect(find.text('Unlock was not turned on because the check did not pass.'), findsOneWidget);
    expect(tester.widget<Switch>(find.byType(Switch)).value, isFalse);

    app.unlock.passes = true;
    await tester.tap(find.byType(Switch));
    await settle(tester);
    expect(tester.widget<Switch>(find.byType(Switch)).value, isTrue);
    expect(app.cache.values['biometric-unlock'], 'on');
  });

  testWidgets('with unlock on, the app opens locked until the check passes', (tester) async {
    final app = signedInStudent();
    app.cache.values['biometric-unlock'] = 'on';
    app.unlock.passes = false;
    await app.pump(tester);
    expect(find.text('Graduation Tracker is locked'), findsOneWidget);
    expect(find.text('That did not unlock the app. Try again.'), findsOneWidget);

    app.unlock.passes = true;
    await tester.tap(find.widgetWithText(FilledButton, 'Unlock'));
    await settle(tester);
    expect(find.text('Graduation Tracker is locked'), findsNothing);
    expect(find.text('Hello, Ama.'), findsWidgets);
  });

  testWidgets('signing out from the lock screen clears the unlock setting', (tester) async {
    final app = signedInStudent();
    app.cache.values['biometric-unlock'] = 'on';
    app.unlock.passes = false;
    await app.pump(tester);
    await tester.tap(find.text('Sign out instead'));
    await settle(tester);
    expect(find.widgetWithText(FilledButton, 'Sign in'), findsOneWidget);
    expect(find.text('Graduation Tracker is locked'), findsNothing);
    expect(app.cache.values, isEmpty);
    expect(app.tokens.cookie, isNull);
  });

  testWidgets('devices without biometrics or a passcode cannot turn it on', (tester) async {
    final app = signedInStudent();
    app.unlock.available = false;
    await app.pump(tester);
    await tester.tap(find.text('Profile').last);
    await settle(tester);
    await tester.tap(find.text('Unlock and password'));
    await settle(tester);
    expect(find.textContaining('no Face ID, fingerprint or passcode'), findsOneWidget);
    expect(tester.widget<Switch>(find.byType(Switch)).onChanged, isNull);
  });
}
