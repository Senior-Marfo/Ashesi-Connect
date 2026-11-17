import 'package:ashesi_graduation_tracker/app/router.dart';
import 'package:ashesi_graduation_tracker/core/theme/app_theme.dart';
import 'package:ashesi_graduation_tracker/features/auth/app_lock.dart';
import 'package:ashesi_graduation_tracker/features/auth/lock_screen.dart';
import 'package:ashesi_graduation_tracker/features/auth/session.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class GraduationTrackerApp extends ConsumerStatefulWidget {
  const GraduationTrackerApp({super.key});

  @override
  ConsumerState<GraduationTrackerApp> createState() => _GraduationTrackerAppState();
}

class _GraduationTrackerAppState extends ConsumerState<GraduationTrackerApp> {
  late final AppLifecycleListener _lifecycle;

  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(
      onHide: () => ref.read(appLockProvider.notifier).hiddenAt = DateTime.now(),
      onShow: () => ref.read(appLockProvider.notifier).appShown(DateTime.now()),
    );
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = ref.watch(sessionProvider).value != null;
    final locked = ref.watch(appLockProvider).value?.locked ?? false;
    return MaterialApp.router(
      title: 'Graduation Tracker',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      routerConfig: ref.watch(routerProvider),
      // The lock covers whatever screen is open, so navigation state survives unlocking.
      builder: (context, child) => Stack(
        children: [
          ?child,
          if (signedIn && locked) const Positioned.fill(child: LockScreen()),
        ],
      ),
    );
  }
}
