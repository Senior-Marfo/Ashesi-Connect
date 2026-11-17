import 'package:ashesi_graduation_tracker/core/theme/tokens.dart';
import 'package:ashesi_graduation_tracker/features/student/student_data.dart';
import 'package:ashesi_graduation_tracker/models/labels.dart';
import 'package:ashesi_graduation_tracker/models/student.dart';
import 'package:ashesi_graduation_tracker/widgets/page.dart';
import 'package:ashesi_graduation_tracker/widgets/status.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CoursesScreen extends ConsumerWidget {
  const CoursesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final record = ref.watch(myRecordProvider);
    final passMarks =
        ref.watch(myEligibilityProvider).value?.value.passMarks ?? const <String, String>{};
    Future<void> refresh() async {
      ref
        ..invalidate(myEligibilityProvider)
        ..invalidate(myRecordProvider);
      await ref.read(myRecordProvider.future);
    }

    return LargeTitlePage(
      eyebrow: 'My academic record',
      title: 'Courses',
      onRefresh: refresh,
      slivers: [
        switch (record) {
          AsyncData(:final value) => SliverList.list(
            children: [
              if (value.fromCache) OfflineBanner(value.savedAt!),
              if (value.value.courses.isEmpty)
                const EmptyState('No courses are on record yet.')
              else
                CourseList(courses: value.value.courses, passMarks: passMarks),
            ],
          ),
          AsyncError(:final error) => LoadError(
            error: error,
            what: 'Your courses',
            onRetry: () => ref.invalidate(myRecordProvider),
          ),
          _ => const LoadingSliver(),
        },
      ],
    );
  }
}

/// Courses grouped by the term of their latest attempt, newest first, with attempt history.
class CourseList extends StatelessWidget {
  const CourseList({required this.courses, required this.passMarks, super.key});

  final List<CourseRecord> courses;
  final Map<String, String> passMarks;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final byTerm = <String, List<CourseRecord>>{};
    for (final course in courses) {
      byTerm.putIfAbsent(course.latest?.semester ?? 'Term not recorded', () => []).add(course);
    }
    final terms = byTerm.keys.toList()..sort((a, b) => _termOrder(b).compareTo(_termOrder(a)));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final term in terms) ...[
          Padding(
            padding: const EdgeInsets.only(top: Space.s4, bottom: Space.s2),
            child: Semantics(
              header: true,
              child: Text(term.toUpperCase(), style: context.text.labelSmall),
            ),
          ),
          for (final course in byTerm[term]!..sort((a, b) => a.courseCode.compareTo(b.courseCode)))
            _CourseRow(course: course, passMark: passMarks[course.courseCode]),
        ],
        const SizedBox(height: Space.s4),
        Text(
          'Passed or Below pass mark uses each course’s pass mark from your programme requirements.',
          style: TextStyle(color: colors.inkSoft, fontSize: 12),
        ),
      ],
    );
  }

  /// "2025 Fall" → sortable number; unknown terms sort last.
  static int _termOrder(String term) {
    final match = RegExp(r'^(\d{4}) (Spring|Summer|Fall)$').firstMatch(term);
    if (match == null) return -1;
    return int.parse(match[1]!) * 3 + ['Spring', 'Summer', 'Fall'].indexOf(match[2]!);
  }
}

class _CourseRow extends StatelessWidget {
  const _CourseRow({required this.course, required this.passMark});

  final CourseRecord course;
  final String? passMark;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final latest = course.latest;
    final earlier = course.attempts.length > 1
        ? course.attempts.sublist(0, course.attempts.length - 1)
        : const <CourseAttempt>[];
    final chip = switch (latest?.status) {
      AttemptStatus.enrolled => const StateChip(label: 'In progress', tone: ChipTone.progress),
      AttemptStatus.incomplete => const StateChip(label: 'Incomplete', tone: ChipTone.error),
      _ when latest?.grade != null && passMark != null =>
        meetsPassMark(latest!.grade!, passMark!)
            ? const StateChip(label: 'Passed', tone: ChipTone.ok)
            : const StateChip(label: 'Below pass mark', tone: ChipTone.error),
      _ => const StateChip(label: 'Graded', tone: ChipTone.neutral),
    };
    return Container(
      padding: const EdgeInsets.symmetric(vertical: Space.s3),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: colors.line)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  course.courseCode,
                  style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  '${credits(latest?.credits ?? 0)} credit${latest?.credits == 1 ? '' : 's'}'
                  '${passMark == null ? '' : ' · Pass mark $passMark'}',
                  style: TextStyle(color: colors.inkSoft, fontSize: 13),
                ),
                if (earlier.isNotEmpty)
                  Text(
                    'Earlier: ${earlier.map((attempt) => '${attempt.grade ?? attempt.status.name} (${attempt.semester ?? 'term not recorded'})').join(', ')}',
                    style: TextStyle(color: colors.inkSoft, fontSize: 13),
                  ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(latest?.grade ?? '—', style: context.text.titleLarge),
              const SizedBox(height: Space.s1),
              chip,
            ],
          ),
        ],
      ),
    );
  }
}
