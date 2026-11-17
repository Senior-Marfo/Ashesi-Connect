import 'package:ashesi_graduation_tracker/models/json.dart';

class StudentSummary {
  const StudentSummary({
    required this.studentId,
    required this.fullName,
    required this.programme,
    required this.yearGroup,
    required this.track,
    this.synthetic = false,
  });

  factory StudentSummary.fromJson(Json json) => StudentSummary(
    studentId: str(json, 'studentId'),
    fullName: str(json, 'fullName'),
    programme: str(json, 'programme'),
    yearGroup: int_(json, 'yearGroup'),
    track: str(json, 'track', 'standard'),
    synthetic: json['synthetic'] == true,
  );

  final String studentId;
  final String fullName;
  final String programme;
  final int yearGroup;
  final String track;
  final bool synthetic;

  String get firstName => fullName.split(' ').first;
}

enum AttemptStatus { completed, enrolled, incomplete }

class CourseAttempt {
  const CourseAttempt({required this.credits, required this.status, this.grade, this.semester});

  factory CourseAttempt.fromJson(Json json) => CourseAttempt(
    credits: num_(json, 'credits'),
    status: switch (str(json, 'status')) {
      'ENROLLED' => AttemptStatus.enrolled,
      'INCOMPLETE' => AttemptStatus.incomplete,
      _ => AttemptStatus.completed,
    },
    grade: strOrNull(json, 'grade'),
    semester: strOrNull(json, 'semester'),
  );

  final double credits;
  final AttemptStatus status;
  final String? grade;
  final String? semester;
}

class CourseRecord {
  const CourseRecord({required this.courseCode, required this.attempts});

  factory CourseRecord.fromJson(Json json) => CourseRecord(
    courseCode: str(json, 'courseCode'),
    attempts: objects(json, 'attempts').map(CourseAttempt.fromJson).toList(),
  );

  final String courseCode;

  /// Oldest first; the last is the attempt that counts.
  final List<CourseAttempt> attempts;

  CourseAttempt? get latest => attempts.isEmpty ? null : attempts.last;
}

class StudentRecord {
  const StudentRecord({required this.student, required this.courses});

  factory StudentRecord.fromJson(Json json) => StudentRecord(
    student: StudentSummary.fromJson(json['student'] is Json ? json['student'] as Json : const {}),
    courses: objects(json, 'courses').map(CourseRecord.fromJson).toList(),
  );

  final StudentSummary student;
  final List<CourseRecord> courses;
}

/// The grade scale from lowest to highest, for comparing a grade with a pass mark.
const gradeScale = ['E', 'D', 'D+', 'C', 'C+', 'B', 'B+', 'A', 'A+'];

bool meetsPassMark(String grade, String passMark) {
  final index = gradeScale.indexOf(grade);
  return index >= 0 && index >= gradeScale.indexOf(passMark);
}
