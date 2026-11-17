import 'package:ashesi_graduation_tracker/core/theme/tokens.dart';
import 'package:ashesi_graduation_tracker/features/auth/session.dart';
import 'package:ashesi_graduation_tracker/widgets/page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Shown while the stored session is restored.
class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(Space.s5),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: 'Ashesi\n',
                        style: TextStyle(color: context.colors.maroon),
                      ),
                      const TextSpan(text: 'Graduation Tracker'),
                    ],
                  ),
                  textAlign: TextAlign.center,
                  style: context.text.displaySmall,
                ),
                const SizedBox(height: Space.s6),
                if (session.hasError) ...[
                  const Notice('The service could not be reached.', error: true),
                  const SizedBox(height: Space.s3),
                  OutlinedButton(
                    onPressed: () => ref.read(sessionProvider.notifier).reconnect(),
                    child: const Text('Try again'),
                  ),
                ] else
                  const CircularProgressIndicator.adaptive(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
