import 'package:ashesi_graduation_tracker/app/splash_screen.dart';
import 'package:ashesi_graduation_tracker/app/student_shell.dart';
import 'package:ashesi_graduation_tracker/core/api/api_client.dart';
import 'package:ashesi_graduation_tracker/features/admin/search_screen.dart';
import 'package:ashesi_graduation_tracker/features/admin/student_screen.dart';
import 'package:ashesi_graduation_tracker/features/auth/change_password_screen.dart';
import 'package:ashesi_graduation_tracker/features/auth/session.dart';
import 'package:ashesi_graduation_tracker/features/auth/sign_in_screen.dart';
import 'package:ashesi_graduation_tracker/features/student/courses_screen.dart';
import 'package:ashesi_graduation_tracker/features/student/inbox_screen.dart';
import 'package:ashesi_graduation_tracker/features/student/profile_screen.dart';
import 'package:ashesi_graduation_tracker/features/student/remaining_screen.dart';
import 'package:ashesi_graduation_tracker/features/student/requirements_screen.dart';
import 'package:ashesi_graduation_tracker/features/student/status_screen.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Where a session belongs. Pure, so the role rules are unit-tested without widgets.
String? redirectFor(AsyncValue<Session?> session, String location) {
  if (session.isLoading || session.hasError) return location == '/' ? null : '/';
  final current = session.value;
  if (current == null) return location == '/sign-in' ? null : '/sign-in';
  if (current.info.passwordChangeRequired) {
    return location == '/change-password' ? null : '/change-password';
  }
  final home = current.role == Role.admin ? '/admin' : '/student';
  if (location == '/' || location == '/sign-in') return home;
  if (location == '/change-password' && !current.offline) return null;
  // The role comes from the server; the app only shows that role's screens.
  return location.startsWith(home) ? null : home;
}

final routerProvider = Provider<GoRouter>((ref) {
  final session = ValueNotifier<AsyncValue<Session?>>(ref.read(sessionProvider));
  ref
    ..listen(sessionProvider, (_, next) => session.value = next)
    ..onDispose(session.dispose);
  final root = GlobalKey<NavigatorState>();
  return GoRouter(
    navigatorKey: root,
    initialLocation: '/',
    refreshListenable: session,
    redirect: (context, state) => redirectFor(session.value, state.matchedLocation),
    routes: [
      GoRoute(path: '/', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/sign-in', builder: (_, _) => const SignInScreen()),
      GoRoute(path: '/change-password', builder: (_, _) => const ChangePasswordScreen()),
      GoRoute(
        path: '/student/remaining',
        parentNavigatorKey: root,
        builder: (_, _) => const RemainingScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => StudentShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [GoRoute(path: '/student', builder: (_, _) => const StatusScreen())],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/student/requirements', builder: (_, _) => const RequirementsScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/student/courses', builder: (_, _) => const CoursesScreen())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/student/inbox', builder: (_, _) => const InboxScreen())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/student/profile', builder: (_, _) => const ProfileScreen())],
          ),
        ],
      ),
      GoRoute(
        path: '/admin',
        builder: (_, _) => const SearchScreen(),
        routes: [
          GoRoute(
            path: 'student/:id',
            builder: (_, state) => AdminStudentScreen(studentId: state.pathParameters['id']!),
          ),
        ],
      ),
    ],
  );
});
