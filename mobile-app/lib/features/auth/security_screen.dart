import 'package:ashesi_graduation_tracker/core/theme/tokens.dart';
import 'package:ashesi_graduation_tracker/features/auth/app_lock.dart';
import 'package:ashesi_graduation_tracker/features/auth/session.dart';
import 'package:ashesi_graduation_tracker/widgets/page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

final FutureProvider<bool> _unlockAvailableProvider = FutureProvider.autoDispose<bool>(
  (ref) => ref.read(deviceUnlockProvider).isAvailable(),
);

/// Biometric unlock and password change, for students and admins alike.
class SecurityScreen extends ConsumerWidget {
  const SecurityScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lock = ref.watch(appLockProvider).value;
    final available = ref.watch(_unlockAvailableProvider).value ?? false;
    final offline = ref.watch(sessionProvider).value?.offline ?? false;
    return LargeTitlePage(
      title: 'Security',
      bottomPadding: Space.s6,
      slivers: [
        SliverList.list(
          children: [
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              title: const Text('Unlock with Face ID or fingerprint'),
              subtitle: Text(
                available
                    ? 'Asks when the app opens and after a minute in the background. Your passcode works as a fallback.'
                    : 'This device has no Face ID, fingerprint or passcode set up.',
              ),
              value: lock?.enabled ?? false,
              onChanged: !available || lock == null
                  ? null
                  : (enabled) async {
                      final changed = await ref
                          .read(appLockProvider.notifier)
                          .setEnabled(enabled: enabled);
                      if (!changed && context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text(
                              'Unlock was not turned on because the check did not pass.',
                            ),
                          ),
                        );
                      }
                    },
            ),
            const Divider(),
            const SizedBox(height: Space.s3),
            if (offline)
              const Notice('You are offline. Reconnect to change your password.')
            else
              OutlinedButton.icon(
                onPressed: () => context.push('/change-password'),
                icon: const Icon(Icons.lock_outline),
                label: const Text('Change password'),
              ),
          ],
        ),
      ],
    );
  }
}
