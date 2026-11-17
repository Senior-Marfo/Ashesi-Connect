import 'package:ashesi_graduation_tracker/core/theme/tokens.dart';
import 'package:ashesi_graduation_tracker/features/student/student_data.dart';
import 'package:ashesi_graduation_tracker/models/eligibility.dart';
import 'package:ashesi_graduation_tracker/models/labels.dart';
import 'package:ashesi_graduation_tracker/widgets/page.dart';
import 'package:ashesi_graduation_tracker/widgets/status.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class RequirementsScreen extends ConsumerStatefulWidget {
  const RequirementsScreen({super.key});

  @override
  ConsumerState<RequirementsScreen> createState() => _RequirementsScreenState();
}

class _RequirementsScreenState extends ConsumerState<RequirementsScreen> {
  RequirementState? _filter;
  String _search = '';

  @override
  Widget build(BuildContext context) {
    final load = ref.watch(myEligibilityProvider);
    return LargeTitlePage(
      eyebrow: 'My programme',
      title: 'Requirements',
      onRefresh: () => ref.refresh(myEligibilityProvider.future),
      slivers: [
        switch (load) {
          AsyncData(:final value) => SliverList.list(
            children: [
              if (value.fromCache) OfflineBanner(value.savedAt!),
              TextField(
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search),
                  hintText: 'Search courses',
                ),
                onChanged: (text) => setState(() => _search = text.trim().toUpperCase()),
              ),
              const SizedBox(height: Space.s3),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (final state in [null, ...RequirementState.values])
                      Padding(
                        padding: const EdgeInsets.only(right: Space.s2),
                        child: FilterChip(
                          label: Text(state == null ? 'All' : stateLabel(state)),
                          selected: _filter == state,
                          onSelected: (_) => setState(() => _filter = state),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: Space.s4),
              if (value.value.requirements.isEmpty)
                const EmptyState('No requirements are available yet.')
              else
                RequirementTree(groups: value.value.requirements, filter: _filter, search: _search),
            ],
          ),
          AsyncError(:final error) => LoadError(
            error: error,
            what: 'Your requirements',
            onRetry: () => ref.invalidate(myEligibilityProvider),
          ),
          _ => const LoadingSliver(),
        },
      ],
    );
  }
}

/// Requirement groups as expandable sections; shared with the admin student view.
class RequirementTree extends StatelessWidget {
  const RequirementTree({required this.groups, super.key, this.filter, this.search = ''});

  final List<RequirementGroup> groups;
  final RequirementState? filter;
  final String search;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final visible = [
      for (final group in groups)
        (
          group: group,
          items: group.items
              .where(
                (item) =>
                    (filter == null || item.state == filter) &&
                    item.code.toUpperCase().contains(search),
              )
              .toList(),
        ),
    ].where((entry) => entry.items.isNotEmpty || (filter == null && search.isEmpty)).toList();
    if (visible.isEmpty) return const EmptyState('Nothing matches this filter.');
    return Column(
      children: [
        for (final (:group, :items) in visible)
          Card(
            margin: const EdgeInsets.only(bottom: Space.s3),
            elevation: 0,
            color: colors.raised,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(Radii.card),
              side: BorderSide(color: colors.line),
            ),
            clipBehavior: Clip.antiAlias,
            child: ExpansionTile(
              // A new key when the filter changes, so matching groups open even if collapsed before.
              key: ValueKey('${group.category}|$filter|$search'),
              initiallyExpanded: filter != null || search.isNotEmpty,
              shape: const Border(),
              title: Text(group.category, style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Padding(
                padding: const EdgeInsets.only(top: Space.s2),
                child: _GroupProgress(group: group),
              ),
              children: [
                for (final item in items)
                  ListTile(
                    title: Text(
                      item.code,
                      style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w600),
                    ),
                    subtitle: Text(
                      '${credits(item.credits)} credit${item.credits == 1 ? '' : 's'} · Pass mark ${item.minimumGrade}'
                      '${item.grade == null ? '' : ' · Grade ${item.grade}'}'
                      '${item.attempts > 1 ? ' · ${item.attempts} attempts' : ''}',
                    ),
                    trailing: StateChip.forState(item.state),
                  ),
                if (group.elective && group.options.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(Space.s4, 0, Space.s4, Space.s4),
                    child: Text(
                      'Options: ${group.options.join(', ')}',
                      style: TextStyle(color: colors.inkSoft, fontSize: 13),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class _GroupProgress extends StatelessWidget {
  const _GroupProgress({required this.group});

  final RequirementGroup group;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final total = group.creditsRequired <= 0 ? 1 : group.creditsRequired;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: SizedBox(
            height: 6,
            child: Stack(
              fit: StackFit.expand,
              children: [
                ColoredBox(color: colors.line),
                FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: ((group.creditsCompleted + group.creditsInProgress) / total).clamp(
                    0,
                    1,
                  ),
                  child: ColoredBox(color: colors.maroon.withValues(alpha: 0.35)),
                ),
                FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: (group.creditsCompleted / total).clamp(0, 1),
                  child: ColoredBox(color: colors.maroon),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: Space.s1),
        Text(
          '${credits(group.creditsCompleted)} of ${credits(group.creditsRequired)} credits'
          '${group.creditsInProgress > 0 ? ' · ${credits(group.creditsInProgress)} in progress' : ''}',
          style: TextStyle(color: colors.inkSoft, fontSize: 13),
        ),
      ],
    );
  }
}
