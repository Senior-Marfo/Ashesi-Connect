import 'package:ashesi_graduation_tracker/core/providers.dart';
import 'package:ashesi_graduation_tracker/models/eligibility.dart';
import 'package:ashesi_graduation_tracker/models/json.dart';
import 'package:ashesi_graduation_tracker/models/message.dart';
import 'package:ashesi_graduation_tracker/models/student.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';

class SearchResult {
  const SearchResult(this.student, {required this.closeMatch});

  factory SearchResult.fromJson(Json json) => SearchResult(
    StudentSummary.fromJson(json),
    closeMatch: str(json, 'match').startsWith('CLOSE'),
  );

  final StudentSummary student;
  final bool closeMatch;
}

/// Matches for an ID fragment or name, with close matches when nothing matches as typed.
final FutureProviderFamily<List<SearchResult>, String> studentSearchProvider = FutureProvider
    .autoDispose
    .family<List<SearchResult>, String>((ref, query) async {
      if (query.trim().isEmpty) return const [];
      final json = await ref
          .read(apiClientProvider)
          .getJson('/admin/students', query: {'q': query.trim()});
      return objects(json, 'students').map(SearchResult.fromJson).toList();
    });

final FutureProviderFamily<StudentRecord, String> adminRecordProvider = FutureProvider.autoDispose
    .family<StudentRecord, String>((ref, studentId) async {
      final json = await ref
          .read(apiClientProvider)
          .getJson('/admin/students/${Uri.encodeComponent(studentId)}');
      return StudentRecord.fromJson(json);
    });

final FutureProviderFamily<Eligibility, String> adminEligibilityProvider = FutureProvider
    .autoDispose
    .family<Eligibility, String>((ref, studentId) async {
      final json = await ref
          .read(apiClientProvider)
          .getJson('/admin/students/${Uri.encodeComponent(studentId)}/eligibility');
      return Eligibility.fromJson(json);
    });

final AsyncNotifierProviderFamily<NotesController, List<StudentNote>, String> notesProvider =
    AsyncNotifierProvider.autoDispose.family<NotesController, List<StudentNote>, String>(
      NotesController.new,
    );

class NotesController extends AsyncNotifier<List<StudentNote>> {
  NotesController(this.studentId);

  final String studentId;

  String get _path => '/admin/students/${Uri.encodeComponent(studentId)}/notes';

  @override
  Future<List<StudentNote>> build() async {
    final json = await ref.read(apiClientProvider).getJson(_path);
    return objects(json, 'notes').map(StudentNote.fromJson).toList();
  }

  Future<void> add(String body) async {
    final json = await ref.read(apiClientProvider).postJson(_path, {'body': body});
    final note = StudentNote.fromJson(json['note'] as Json);
    state = AsyncData([note, ...?state.value]);
  }
}
