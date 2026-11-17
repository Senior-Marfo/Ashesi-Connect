import 'package:ashesi_graduation_tracker/models/eligibility.dart';
import 'package:ashesi_graduation_tracker/models/labels.dart';
import 'package:ashesi_graduation_tracker/models/message.dart';
import 'package:ashesi_graduation_tracker/models/student.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fixtures.dart';

void main() {
  test('parses the eligibility assessment the API returns', () {
    final eligibility = Eligibility.fromJson(eligibilityJson());
    expect(eligibility.student.firstName, 'Ama');
    expect(eligibility.status, EligibilityStatus.requirementsRemaining);
    expect(eligibility.syntheticRules, isTrue);
    expect(eligibility.audit!.creditsRequired, 34.5);
    expect(eligibility.audit!.remaining.map((item) => item.reason), [
      'IN_PROGRESS',
      'FAILED',
      'NOT_TAKEN',
    ]);
    expect(eligibility.standing!.level, StandingLevel.yellow);
    expect(eligibility.requirements.first.items.last.state, RequirementState.inProgress);
    expect(eligibility.nextActions.first.kind, 'RETAKE');
    expect(eligibility.passMarks, {'CS 212': 'D+', 'CS 321': 'D+', 'MATH 141': 'C'});
  });

  test('tolerates missing sections, such as a student without a curriculum', () {
    final eligibility = Eligibility.fromJson({
      'student': {'studentId': '20310001', 'fullName': 'New Student'},
      'status': 'NO_CURRICULUM',
      'audit': null,
      'standing': null,
      'issues': ['CURRICULUM_UNAVAILABLE'],
    });
    expect(eligibility.status, EligibilityStatus.noCurriculum);
    expect(eligibility.audit, isNull);
    expect(eligibility.requirements, isEmpty);
    expect(eligibility.student.track, 'standard');
    expect(describeIssue(eligibility.issues.single), contains('not been reviewed'));
  });

  test('compares grades with a course pass mark', () {
    expect(meetsPassMark('C', 'C'), isTrue);
    expect(meetsPassMark('D+', 'C'), isFalse);
    expect(meetsPassMark('A+', 'D+'), isTrue);
    expect(meetsPassMark('P', 'D+'), isFalse);
  });

  test('keeps every course attempt, oldest first', () {
    final record = StudentRecord.fromJson({
      'student': {
        'studentId': '20280001',
        'fullName': 'Ama Mensah',
        'programme': 'CS',
        'yearGroup': 2028,
      },
      'courses': [
        {
          'courseCode': 'MATH 141',
          'attempts': [
            {'credits': 1, 'grade': 'D', 'status': 'COMPLETED', 'semester': '2024 Fall'},
            {'credits': 1, 'status': 'ENROLLED', 'semester': '2025 Spring'},
          ],
        },
      ],
    });
    final course = record.courses.single;
    expect(course.attempts, hasLength(2));
    expect(course.latest!.status, AttemptStatus.enrolled);
    expect(course.latest!.grade, isNull);
  });

  test('reads inbox items and marks them read', () {
    final items = (inboxJson()['messages']! as List)
        .cast<Map<String, dynamic>>()
        .map(InboxItem.fromJson)
        .toList();
    expect(items.first.unread, isTrue);
    expect(items.first.highPriority, isTrue);
    expect(items.last.unread, isFalse);
    expect(items.first.markedRead(DateTime(2026)).unread, isFalse);
  });

  test('uses the same wording as the web client', () {
    expect(standingLabel(StandingLevel.red), 'Critical');
    expect(describeStandingReason('CANNOT_FINISH_IN_TIME', 7.5), contains('7.5 credits a term'));
    expect(reasonLabel('ELECTIVE_SLOT_OPEN'), 'Elective credits still needed');
    expect(credits(3), '3');
    expect(credits(0.5), '0.5');
    expect(sentenceCase('SOMETHING_NEW'), 'Something new');
  });
}
