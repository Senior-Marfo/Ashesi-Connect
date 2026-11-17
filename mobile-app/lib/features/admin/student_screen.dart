import 'package:ashesi_graduation_tracker/core/api/api_error.dart';
import 'package:ashesi_graduation_tracker/core/theme/tokens.dart';
import 'package:ashesi_graduation_tracker/features/admin/admin_data.dart';
import 'package:ashesi_graduation_tracker/features/student/courses_screen.dart';
import 'package:ashesi_graduation_tracker/features/student/requirements_screen.dart';
import 'package:ashesi_graduation_tracker/features/student/status_screen.dart';
import 'package:ashesi_graduation_tracker/models/labels.dart';
import 'package:ashesi_graduation_tracker/widgets/page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

/// An admin's view of one student: the same audit as the student sees, plus staff notes.
class AdminStudentScreen extends ConsumerWidget {
  const AdminStudentScreen({required this.studentId, super.key});

  final String studentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final record = ref.watch(adminRecordProvider(studentId));
    final eligibility = ref.watch(adminEligibilityProvider(studentId));
    return LargeTitlePage(
      eyebrow: studentId,
      title: record.value?.student.fullName ?? 'Student',
      bottomPadding: Space.s6,
      onRefresh: () async {
        ref
          ..invalidate(adminRecordProvider(studentId))
          ..invalidate(adminEligibilityProvider(studentId))
          ..invalidate(notesProvider(studentId));
        await ref.read(adminRecordProvider(studentId).future);
      },
      slivers: [
        switch (record) {
          AsyncData(:final value) => SliverList.list(
            children: [
              if (value.student.synthetic)
                const Padding(
                  padding: EdgeInsets.only(bottom: Space.s4),
                  child: Notice('Synthetic record: a fictional student loaded for demonstration.'),
                ),
              Wrap(
                spacing: Space.s6,
                runSpacing: Space.s4,
                children: [
                  Fact('Programme', value.student.programme),
                  Fact('Year group', '${value.student.yearGroup}'),
                  Fact('Maths track', trackLabel(value.student.track)),
                ],
              ),
              const SizedBox(height: Space.s5),
              switch (eligibility) {
                AsyncData(value: final audit) => Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    StatusCard(eligibility: audit),
                    if (audit.requirements.isNotEmpty) ...[
                      const SizedBox(height: Space.s5),
                      Text('Requirements', style: context.text.headlineSmall),
                      const SizedBox(height: Space.s3),
                      RequirementTree(groups: audit.requirements),
                    ],
                    const SizedBox(height: Space.s5),
                    Text('Courses', style: context.text.headlineSmall),
                    if (value.courses.isEmpty)
                      const Padding(
                        padding: EdgeInsets.only(top: Space.s3),
                        child: EmptyState('No courses are on record yet.'),
                      )
                    else
                      CourseList(courses: value.courses, passMarks: audit.passMarks),
                  ],
                ),
                AsyncError() => const Notice(
                  'Graduation status could not be loaded for this student.',
                  error: true,
                ),
                _ => const Center(child: CircularProgressIndicator.adaptive()),
              },
              const SizedBox(height: Space.s6),
              _Notes(studentId: studentId),
            ],
          ),
          AsyncError(:final error) => LoadError(
            error: error,
            what: 'This record',
            onRetry: () => ref.invalidate(adminRecordProvider(studentId)),
          ),
          _ => const LoadingSliver(),
        },
      ],
    );
  }
}

class _Notes extends ConsumerStatefulWidget {
  const _Notes({required this.studentId});

  final String studentId;

  @override
  ConsumerState<_Notes> createState() => _NotesState();
}

class _NotesState extends ConsumerState<_Notes> {
  final _draft = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _draft.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    final body = _draft.text.trim();
    if (body.isEmpty) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(notesProvider(widget.studentId).notifier).add(body);
      _draft.clear();
    } on ApiError catch (error) {
      setState(() => _error = error.describe('The note could not be saved.'));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final notes = ref.watch(notesProvider(widget.studentId));
    final colors = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Staff notes', style: context.text.headlineSmall),
        const SizedBox(height: Space.s1),
        Text(
          'Visible to administrators only. Each note is audit-logged and cannot be edited.',
          style: TextStyle(color: colors.inkSoft, fontSize: 13),
        ),
        const SizedBox(height: Space.s3),
        TextField(
          controller: _draft,
          minLines: 2,
          maxLines: 6,
          maxLength: 2000,
          decoration: const InputDecoration(labelText: 'New note'),
        ),
        if (_error != null) ...[Notice(_error!, error: true), const SizedBox(height: Space.s2)],
        Align(
          alignment: Alignment.centerLeft,
          child: OutlinedButton(
            onPressed: _saving ? null : _add,
            child: Text(_saving ? 'Saving…' : 'Add note'),
          ),
        ),
        const SizedBox(height: Space.s4),
        switch (notes) {
          AsyncData(:final value) when value.isEmpty => const EmptyState('No notes yet.'),
          AsyncData(:final value) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final note in value)
                Padding(
                  padding: const EdgeInsets.only(bottom: Space.s4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(note.body),
                      Text(
                        '${note.author} · ${DateFormat.yMMMd().add_jm().format(note.createdAt.toLocal())}',
                        style: TextStyle(color: colors.inkSoft, fontSize: 12),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          AsyncError() => const Notice('Notes could not be loaded.', error: true),
          _ => const SizedBox.shrink(),
        },
      ],
    );
  }
}
