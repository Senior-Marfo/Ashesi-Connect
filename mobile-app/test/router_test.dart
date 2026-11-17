import 'package:ashesi_graduation_tracker/app/router.dart';
import 'package:ashesi_graduation_tracker/core/api/api_client.dart';
import 'package:ashesi_graduation_tracker/features/auth/session.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

AsyncValue<Session?> signedIn(
  Role role, {
  bool passwordChangeRequired = false,
  bool offline = false,
}) => AsyncData(
  Session(
    SessionInfo(role: role, passwordChangeRequired: passwordChangeRequired),
    offline: offline,
  ),
);

void main() {
  test('waits on the splash screen while the session is restored', () {
    expect(redirectFor(const AsyncLoading(), '/student'), '/');
    expect(redirectFor(const AsyncLoading(), '/'), isNull);
  });

  test('sends signed-out users to sign in', () {
    expect(redirectFor(const AsyncData(null), '/student'), '/sign-in');
    expect(redirectFor(const AsyncData(null), '/sign-in'), isNull);
  });

  test('a temporary password must be changed before anything else', () {
    final session = signedIn(Role.student, passwordChangeRequired: true);
    expect(redirectFor(session, '/student'), '/change-password');
    expect(redirectFor(session, '/change-password'), isNull);
  });

  test('each role reaches only its own screens', () {
    expect(redirectFor(signedIn(Role.student), '/sign-in'), '/student');
    expect(redirectFor(signedIn(Role.student), '/student/inbox'), isNull);
    expect(redirectFor(signedIn(Role.student), '/admin/student/20280002'), '/student');
    expect(redirectFor(signedIn(Role.admin), '/'), '/admin');
    expect(redirectFor(signedIn(Role.admin), '/admin/student/20280002'), isNull);
    expect(redirectFor(signedIn(Role.admin), '/student'), '/admin');
  });

  test('a voluntary password change is allowed online only', () {
    expect(redirectFor(signedIn(Role.student), '/change-password'), isNull);
    expect(redirectFor(signedIn(Role.student, offline: true), '/change-password'), '/student');
  });
}
