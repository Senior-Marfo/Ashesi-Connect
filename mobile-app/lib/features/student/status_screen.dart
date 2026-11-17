import 'package:ashesi_graduation_tracker/core/theme/tokens.dart';
import 'package:ashesi_graduation_tracker/features/student/student_data.dart';
import 'package:ashesi_graduation_tracker/models/eligibility.dart';
import 'package:ashesi_graduation_tracker/models/labels.dart';
import 'package:ashesi_graduation_tracker/widgets/page.dart';
import 'package:ashesi_graduation_tracker/widgets/progress_ring.dart';
import 'package:ashesi_graduation_tracker/widgets/status.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class StatusScreen extends ConsumerWidget {
  const StatusScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final load = ref.watch(myEligibilityProvider);
    final firstName = load.value?.value.student.firstName;
    return LargeTitlePage(
      eyebrow: 'Graduation status',
      title: firstName == null ? 'Your status' : 'Hello, $firstName.',
      onRefresh: () => ref.refresh(myEligibilityProvider.future),
      slivers: [
        switch (load) {
          AsyncData(:final value) => SliverList.list(
            children: [
              if (value.fromCache) OfflineBanner(value.savedAt!),
              StatusCard(eligibility: value.value),
              const SizedBox(height: Space.s4),
              if (value.value.audit != null)
                OutlinedButton.icon(
                  onPressed: () => context.push('/student/remaining'),
                  icon: const Icon(Icons.timeline),
                  label: const Text('Path to graduation'),
                ),
            ],
          ),
          AsyncError(:final error) => LoadError(
            error: error,
            what: 'Your graduation status',
            onRetry: () => ref.invalidate(myEligibilityProvider),
          ),
          _ => const LoadingSliver(),
        },
      ],
    );
  }
}

/// Status, progress ring, credits and the next three actions. Shared with the admin view.
class StatusCard extends StatelessWidget {
  const StatusCard({required this.eligibility, super.key, this.showNextActions = true});

  final Eligibility eligibility;
  final bool showNextActions;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final audit = eligibility.audit;
    final standing = eligibility.standing;
    final met = eligibility.status == EligibilityStatus.requirementsMet;
    final accent = standing == null ? colors.line : standingStyle(context, standing.level).fg;
    return Semantics(
      container: true,
      label: 'Graduation status',
      child: Container(
        decoration: BoxDecoration(
          color: colors.raised,
          borderRadius: BorderRadius.circular(Radii.card),
          border: Border.all(color: colors.line),
        ),
        clipBehavior: Clip.antiAlias,
        child: DecoratedBox(
          decoration: BoxDecoration(
            border: Border(left: BorderSide(color: accent, width: 4)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(Space.s5),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (audit != null) ...[
                  Center(
                    child: ProgressRing(
                      completed: audit.creditsRequired == 0
                          ? 0
                          : audit.creditsEarned / audit.creditsRequired,
                      inProgress: audit.creditsRequired == 0
                          ? 0
                          : audit.creditsInProgress / audit.creditsRequired,
                    ),
                  ),
                  const SizedBox(height: Space.s5),
                ],
                Text(
                  met ? 'Requirements met' : 'Not yet eligible',
                  style: context.text.headlineMedium,
                ),
                if (met) ...[
                  const SizedBox(height: Space.s2),
                  Text(
                    'Every listed requirement is met. The Registry confirms eligibility; this is not a certification.',
                    style: TextStyle(color: colors.inkSoft),
                  ),
                ],
                if (standing != null) ...[
                  const SizedBox(height: Space.s3),
                  StandingBadge(standing.level),
                  const SizedBox(height: Space.s3),
                  for (final reason in standing.reasons)
                    Padding(
                      padding: const EdgeInsets.only(bottom: Space.s1),
                      child: Text(
                        '• ${describeStandingReason(reason, standing.creditsPerTermNeeded)}',
                      ),
                    ),
                ],
                for (final issue in eligibility.issues)
                  Padding(
                    padding: const EdgeInsets.only(top: Space.s3),
                    child: Notice(describeIssue(issue)),
                  ),
                if (audit != null) ...[
                  const SizedBox(height: Space.s4),
                  const Divider(),
                  const SizedBox(height: Space.s3),
                  Wrap(
                    spacing: Space.s6,
                    runSpacing: Space.s4,
                    children: [
                      Fact(
                        'Credits completed',
                        '${credits(audit.creditsEarned)} / ${credits(audit.creditsRequired)}',
                      ),
                      Fact('In progress', credits(audit.creditsInProgress)),
                      Fact('Expected graduation', eligibility.expectedGraduation),
                    ],
                  ),
                ],
                if (showNextActions && eligibility.nextActions.isNotEmpty) ...[
                  const SizedBox(height: Space.s5),
                  Text('NEXT STEPS', style: context.text.labelSmall),
                  const SizedBox(height: Space.s2),
                  for (final action in eligibility.nextActions.take(3))
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3),
                      child: Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: '${actionLabel(action.kind)}  ',
                              style: TextStyle(color: colors.maroon, fontWeight: FontWeight.w700),
                            ),
                            TextSpan(
                              text: '${action.code}  ',
                              style: const TextStyle(fontFamily: 'monospace'),
                            ),
                            TextSpan(
                              text: action.category,
                              style: TextStyle(color: colors.inkSoft),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
                const SizedBox(height: Space.s4),
                Text(
                  eligibility.syntheticRules
                      ? 'Assessed against illustrative synthetic programme rules for demonstration, '
                            'not the official curriculum. Advisory only, never a Registry certification.'
                      : 'Advisory only, never a Registry certification.',
                  style: TextStyle(color: colors.inkSoft, fontSize: 12),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
