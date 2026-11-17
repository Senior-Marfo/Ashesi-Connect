import 'dart:async';
import 'dart:convert';

import 'package:ashesi_graduation_tracker/core/api/api_error.dart';
import 'package:ashesi_graduation_tracker/core/providers.dart';
import 'package:ashesi_graduation_tracker/models/eligibility.dart';
import 'package:ashesi_graduation_tracker/models/json.dart';
import 'package:ashesi_graduation_tracker/models/message.dart';
import 'package:ashesi_graduation_tracker/models/student.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// A value from the server, or the last saved copy when the server could not be reached.
class Loaded<T> {
  const Loaded(this.value, {this.savedAt});

  final T value;

  /// Set when this is an offline copy: when it was saved.
  final DateTime? savedAt;

  bool get fromCache => savedAt != null;
}

/// Fetches JSON and keeps a copy; offline, the copy is returned instead.
Future<Loaded<T>> _cached<T>(
  Ref ref,
  String key,
  Future<Json> Function() fetch,
  T Function(Json) parse,
) async {
  final cache = ref.read(cacheProvider);
  try {
    final json = await fetch();
    await cache.write(key, jsonEncode({'savedAt': DateTime.now().toIso8601String(), 'data': json}));
    return Loaded(parse(json));
  } on ApiError catch (error) {
    final saved = error.isOffline ? await cache.read(key) : null;
    if (saved == null) rethrow;
    final envelope = jsonDecode(saved) as Json;
    return Loaded(parse(envelope['data'] as Json), savedAt: dateOrNull(envelope, 'savedAt'));
  }
}

final myEligibilityProvider = FutureProvider<Loaded<Eligibility>>(
  (ref) => _cached(
    ref,
    'eligibility',
    () => ref.read(apiClientProvider).getJson('/students/me/eligibility'),
    Eligibility.fromJson,
  ),
);

final myRecordProvider = FutureProvider<Loaded<StudentRecord>>(
  (ref) => _cached(
    ref,
    'record',
    () => ref.read(apiClientProvider).getJson('/students/me'),
    StudentRecord.fromJson,
  ),
);

final inboxProvider = AsyncNotifierProvider<InboxController, List<InboxItem>>(InboxController.new);

final unreadCountProvider = Provider<int>(
  (ref) => ref.watch(inboxProvider).value?.where((item) => item.unread).length ?? 0,
);

class InboxController extends AsyncNotifier<List<InboxItem>> {
  @override
  Future<List<InboxItem>> build() async {
    final json = await ref.read(apiClientProvider).getJson('/students/me/messages');
    return objects(json, 'messages').map(InboxItem.fromJson).toList();
  }

  Future<void> markRead(String messageId) async {
    final items = state.value;
    if (items == null || !items.any((item) => item.id == messageId && item.unread)) return;
    final now = DateTime.now();
    state = AsyncData([
      for (final item in items)
        if (item.id == messageId) item.markedRead(now) else item,
    ]);
    await ref
        .read(apiClientProvider)
        .post('/students/me/messages/${Uri.encodeComponent(messageId)}/read');
  }

  Future<void> markAllRead() async {
    final items = state.value;
    if (items == null) return;
    final now = DateTime.now();
    state = AsyncData([
      for (final item in items)
        if (item.unread) item.markedRead(now) else item,
    ]);
    await ref.read(apiClientProvider).post('/students/me/messages/read-all');
  }

  Future<void> refresh() async {
    state = await AsyncValue.guard(build);
  }
}
