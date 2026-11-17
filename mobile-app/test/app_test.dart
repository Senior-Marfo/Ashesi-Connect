import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/app_harness.dart';
import 'support/fake_server.dart';
import 'support/fixtures.dart';

void main() {
  AppHarness studentWithData() {
    final app = AppHarness();
    app.tokens.cookie = 'agt_refresh=r1';
    app.server
      ..on('POST /api/v1/auth/refresh', (_) => FakeResponse(200, tokens(), [refreshCookie('r2')]))
      ..on('GET /api/v1/students/me/eligibility', (_) => FakeResponse(200, eligibilityJson()))
      ..on('GET /api/v1/students/me/messages', (_) => FakeResponse(200, inboxJson()))
      ..on(
        'POST /api/v1/students/me/messages/read-all',
        (_) => const FakeResponse(200, {'marked': 1}),
      );
    return app;
  }

  testWidgets('shows a generic error for a wrong password, then signs a student in', (
    tester,
  ) async {
    final app = AppHarness();
    var attempts = 0;
    app.server
      ..on('POST /api/v1/auth/login', (_) {
        attempts++;
        return attempts == 1
            ? const FakeResponse(401, {'error': 'INVALID_CREDENTIALS'})
            : FakeResponse(200, tokens(), [refreshCookie('r1')]);
      })
      ..on('GET /api/v1/students/me/eligibility', (_) => FakeResponse(200, eligibilityJson()))
      ..on('GET /api/v1/students/me/messages', (_) => FakeResponse(200, inboxJson()));
    await app.pump(tester);

    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pump();
    expect(find.text('Enter your ID.'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextFormField, 'Student or staff ID'), '20280001');
    await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'wrong-password');
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await settle(tester);
    expect(find.text('That ID and password do not match an account.'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await settle(tester);
    expect(find.text('Hello, Ama.'), findsWidgets);
    expect(app.tokens.cookie, 'agt_refresh=r1');
  });

  testWidgets('a temporary password leads straight to setting a new one', (tester) async {
    final app = AppHarness();
    app.server.on(
      'POST /api/v1/auth/login',
      (_) => FakeResponse(200, tokens(passwordChangeRequired: true), [refreshCookie('r1')]),
    );
    await app.pump(tester);
    await tester.enterText(find.widgetWithText(TextFormField, 'Student or staff ID'), '20310001');
    await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'Temporary-Pass-1');
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await settle(tester);
    expect(find.text('Set a new password'), findsOneWidget);
    expect(find.text('Temporary password'), findsOneWidget);
  });

  testWidgets('the status screen shows standing as text and icon, credits and next steps', (
    tester,
  ) async {
    final app = studentWithData();
    await app.pump(tester);
    expect(find.text('Not yet eligible'), findsOneWidget);
    expect(find.text('At risk'), findsOneWidget);
    expect(find.byIcon(Icons.error_outline), findsOneWidget);
    expect(
      find.textContaining('A required course is below its pass mark and needs a retake.'),
      findsOneWidget,
    );
    expect(find.text('20 / 34.5'), findsOneWidget);
    expect(find.text('2028 Spring'), findsOneWidget);
    expect(find.bySemanticsLabel('58 percent of credits completed'), findsOneWidget);
    expect(find.text('Retake  ', findRichText: true), findsNothing);
    expect(find.textContaining('Retake', findRichText: true), findsOneWidget);
  });

  testWidgets('requirements filter by state', (tester) async {
    final app = studentWithData();
    await app.pump(tester);
    await tester.tap(find.text('Requirements').last);
    await settle(tester);
    final chip = find.widgetWithText(FilterChip, 'Below pass mark');
    await tester.ensureVisible(chip);
    await tester.tap(chip);
    await settle(tester);
    expect(find.text('MATH 141'), findsOneWidget);
    expect(find.text('CS 212'), findsNothing);
    expect(find.textContaining('Pass mark C'), findsOneWidget);
  });

  testWidgets('the inbox shows an unread badge and marks everything read', (tester) async {
    final app = studentWithData();
    await app.pump(tester);
    expect(find.bySemanticsLabel('Inbox, 1 unread'), findsOneWidget);
    await tester.tap(find.text('Inbox').last);
    await settle(tester);
    expect(find.text('Retake MATH 141'), findsOneWidget);
    await tester.tap(find.text('Mark all read'));
    await settle(tester);
    expect(find.text('Mark all read'), findsNothing);
    expect(find.bySemanticsLabel('Inbox, 1 unread'), findsNothing);
    expect(app.server.count('POST /api/v1/students/me/messages/read-all'), 1);
  });

  testWidgets('offline at launch, a student sees the last saved status', (tester) async {
    final first = studentWithData();
    await first.pump(tester);
    expect(find.text('Hello, Ama.'), findsWidgets);

    final offline = AppHarness();
    offline.tokens.cookie = first.tokens.cookie;
    offline.cache.values.addAll(first.cache.values);
    offline.server.offline = true;
    await offline.pump(tester);
    expect(find.text('Hello, Ama.'), findsWidgets);
    expect(find.textContaining('Offline. Showing what was saved'), findsOneWidget);
  });

  testWidgets('an admin searches by name and is offered close matches', (tester) async {
    final app = AppHarness();
    app.tokens.cookie = 'agt_refresh=r1';
    app.server
      ..on(
        'POST /api/v1/auth/refresh',
        (_) => FakeResponse(200, tokens(role: 'ADMIN'), [refreshCookie('r2')]),
      )
      ..on('GET /api/v1/admin/students', (request) {
        expect(request.queryParameters['q'], 'mensha');
        return const FakeResponse(200, {
          'students': [
            {
              'studentId': '20280001',
              'fullName': 'Ama Mensah',
              'programme': 'CS',
              'yearGroup': 2028,
              'match': 'CLOSE_NAME',
            },
          ],
        });
      });
    await app.pump(tester);
    expect(find.text('Students'), findsWidgets);
    await tester.enterText(find.widgetWithText(TextField, 'Student ID or name'), 'mensha');
    await settle(tester);
    expect(find.text('Nothing matches exactly. Did you mean one of these?'), findsOneWidget);
    expect(find.textContaining('· Close match'), findsOneWidget);
  });
}
