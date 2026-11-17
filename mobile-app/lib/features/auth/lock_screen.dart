import 'dart:async';

import 'package:ashesi_graduation_tracker/core/theme/tokens.dart';
import 'package:ashesi_graduation_tracker/features/auth/app_lock.dart';
import 'package:ashesi_graduation_tracker/features/auth/session.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Covers the app until the device check passes. Asks straight away, and again on the button.
class LockScreen extends ConsumerStatefulWidget {
  const LockScreen({super.key});

  @override
  ConsumerState<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends ConsumerState<LockScreen> {
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => unawaited(_unlock()));
  }

  Future<void> _unlock() async {
    final passed = await ref.read(appLockProvider.notifier).unlock();
    if (mounted && !passed) setState(() => _failed = true);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(Space.s5),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.lock_outline, size: 48, color: colors.maroon),
                const SizedBox(height: Space.s4),
                Text(
                  'Graduation Tracker is locked',
                  style: context.text.headlineSmall,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: Space.s2),
                Text(
                  _failed
                      ? 'That did not unlock the app. Try again.'
                      : 'Unlock with Face ID, your fingerprint or your passcode.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: colors.inkSoft),
                ),
                const SizedBox(height: Space.s5),
                FilledButton.icon(
                  onPressed: _unlock,
                  icon: const Icon(Icons.fingerprint),
                  label: const Text('Unlock'),
                ),
                const SizedBox(height: Space.s3),
                TextButton(
                  onPressed: () => ref.read(sessionProvider.notifier).signOut(),
                  child: const Text('Sign out instead'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
