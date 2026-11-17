import 'package:ashesi_graduation_tracker/core/theme/tokens.dart';
import 'package:ashesi_graduation_tracker/features/student/student_data.dart';
import 'package:ashesi_graduation_tracker/models/eligibility.dart';
import 'package:ashesi_graduation_tracker/models/labels.dart';
import 'package:ashesi_graduation_tracker/widgets/page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// "Path to graduation": what is left, grouped as a timeline from this term onwards.
class RemainingScreen extends ConsumerWidget {
  const RemainingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final load = ref.watch(myEligibilityProvider);
    return LargeTitlePage(
      eyebrow: 'Path to graduation',
      title: 'What’s remaining',
      bottomPadding: Space.s6,
      onRefresh: () => ref.refresh(myEligibilityProvider.future),
      slivers: [
        switch (load) {
          AsyncData(:final value) => SliverList.list(
            children: [
              if (value.fromCache) OfflineBanner(value.savedAt!),
              ..._timeline(context, value.value),
            ],
          ),
          AsyncError(:final error) => LoadError(
            error: error,
            what: 'What remains',
            onRetry: () => ref.invalidate(myEligibilityProvider),
          ),
          _ => const LoadingSliver(),
        },
      ],
    );
  }

  List<Widget> _timeline(BuildContext context, Eligibility eligibility) {
    final remaining = eligibility.audit?.remaining ?? const <RemainingItem>[];
    if (remaining.isEmpty) return const [EmptyState('Nothing remains on your record.')];
    final now = remaining.where((item) => item.reason == 'IN_PROGRESS').toList();
    final fix = remaining
        .where((item) => item.reason == 'FAILED' || item.reason == 'INCOMPLETE')
        .toList();
    final later = remaining.where((item) => !now.contains(item) && !fix.contains(item)).toList();
    return [
      if (now.isNotEmpty) _Stop(title: 'This term', caption: 'In progress now', items: now),
      if (fix.isNotEmpty)
        _Stop(title: 'To resolve', caption: 'Retakes and incompletes come first', items: fix),
      if (later.isNotEmpty)
        _Stop(
          title: 'Before ${eligibility.expectedGraduation}',
          caption: 'Still to complete',
          items: later,
          last: true,
        ),
    ];
  }
}

class _Stop extends StatelessWidget {
  const _Stop({required this.title, required this.caption, required this.items, this.last = false});

  final String title;
  final String caption;
  final List<RemainingItem> items;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 24,
            child: Column(
              children: [
                const SizedBox(height: 6),
                Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(color: colors.maroon, shape: BoxShape.circle),
                ),
                if (!last) Expanded(child: Container(width: 2, color: colors.line)),
              ],
            ),
          ),
          const SizedBox(width: Space.s3),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: Space.s5),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Semantics(header: true, child: Text(title, style: context.text.titleLarge)),
                  Text(caption, style: TextStyle(color: colors.inkSoft)),
                  const SizedBox(height: Space.s2),
                  for (final item in items)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: Space.s2),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.code == 'TOTAL_CREDITS' ? 'Total credits' : item.code,
                                  style: const TextStyle(fontWeight: FontWeight.w700),
                                ),
                                Text(
                                  '${reasonLabel(item.reason)} · ${item.category}',
                                  style: TextStyle(color: colors.inkSoft, fontSize: 13),
                                ),
                              ],
                            ),
                          ),
                          if (item.credits > 0) Text('${credits(item.credits)} cr'),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
