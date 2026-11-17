import 'package:ashesi_graduation_tracker/models/json.dart';

class InboxItem {
  const InboxItem({
    required this.id,
    required this.title,
    required this.body,
    required this.highPriority,
    required this.sentAt,
    this.readAt,
  });

  factory InboxItem.fromJson(Json json) => InboxItem(
    id: str(json, 'id'),
    title: str(json, 'title'),
    body: str(json, 'body'),
    highPriority: str(json, 'priority') == 'HIGH',
    sentAt: dateOrNull(json, 'sentAt') ?? DateTime.fromMillisecondsSinceEpoch(0),
    readAt: dateOrNull(json, 'readAt'),
  );

  final String id;
  final String title;
  final String body;
  final bool highPriority;
  final DateTime sentAt;
  final DateTime? readAt;

  bool get unread => readAt == null;

  InboxItem markedRead(DateTime at) => InboxItem(
    id: id,
    title: title,
    body: body,
    highPriority: highPriority,
    sentAt: sentAt,
    readAt: at,
  );
}

class StudentNote {
  const StudentNote({
    required this.id,
    required this.body,
    required this.author,
    required this.createdAt,
  });

  factory StudentNote.fromJson(Json json) => StudentNote(
    id: str(json, 'id'),
    body: str(json, 'body'),
    author: str(json, 'author'),
    createdAt: dateOrNull(json, 'createdAt') ?? DateTime.fromMillisecondsSinceEpoch(0),
  );

  final String id;
  final String body;
  final String author;
  final DateTime createdAt;
}
