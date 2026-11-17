import 'package:ashesi_graduation_tracker/core/theme/tokens.dart';
import 'package:ashesi_graduation_tracker/features/auth/session.dart';
import 'package:ashesi_graduation_tracker/features/student/student_data.dart';
import 'package:ashesi_graduation_tracker/models/labels.dart';
import 'package:ashesi_graduation_tracker/widgets/page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final load = ref.watch(myEligibilityProvider);
    final offline = ref.watch(sessionProvider).value?.offline ?? false;
    return LargeTitlePage(
      eyebrow: 'My account',
      title: 'Profile',
      slivers: [
        SliverList.list(
          children: [
            if (load case AsyncData(:final value)) ...[
              Wrap(
                spacing: Space.s6,
                runSpacing: Space.s4,
                children: [
                  Fact('Name', value.value.student.fullName),
                  Fact('Student ID', value.value.student.studentId, mono: true),
                  Fact('Programme', value.value.student.programme),
                  Fact('Year group', '${value.value.student.yearGroup}'),
                  Fact('Maths track', trackLabel(value.value.student.track)),
                  Fact('Expected graduation', value.value.expectedGraduation),
                ],
              ),
              const SizedBox(height: Space.s4),
              Text(
                'If any of these details are wrong, contact the Registry. Only the Registry can change them.',
                style: TextStyle(color: context.colors.inkSoft, fontSize: 13),
              ),
            ] else if (load is AsyncLoading)
              const Center(child: CircularProgressIndicator.adaptive()),
            const SizedBox(height: Space.s6),
            Text('SECURITY', style: context.text.labelSmall),
            const SizedBox(height: Space.s3),
            if (offline) ...[
              const Notice('You are offline. Reconnect to change your password.'),
              const SizedBox(height: Space.s3),
              OutlinedButton(
                onPressed: () => ref.read(sessionProvider.notifier).reconnect(),
                child: const Text('Try to reconnect'),
              ),
            ] else
              OutlinedButton.icon(
                onPressed: () => context.push('/change-password'),
                icon: const Icon(Icons.lock_outline),
                label: const Text('Change password'),
              ),
            const SizedBox(height: Space.s3),
            OutlinedButton.icon(
              onPressed: () => ref.read(sessionProvider.notifier).signOut(),
              icon: const Icon(Icons.logout),
              label: const Text('Sign out'),
            ),
            const SizedBox(height: Space.s5),
            Text(
              'Independent prototype, not an official Ashesi University service.',
              style: TextStyle(color: context.colors.inkSoft, fontSize: 12),
            ),
          ],
        ),
      ],
    );
  }
}
