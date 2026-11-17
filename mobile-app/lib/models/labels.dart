import 'package:ashesi_graduation_tracker/models/eligibility.dart';

/// Wording shared with the web client (web-app/frontend/lib/labels.ts).
String standingLabel(StandingLevel level) => switch (level) {
  StandingLevel.green => 'On track',
  StandingLevel.yellow => 'At risk',
  StandingLevel.red => 'Critical',
};

String describeStandingReason(String reason, double? perTerm) => switch (reason) {
  'REQUIREMENTS_MET' => 'Every listed requirement is met.',
  'ON_TRACK' => 'What remains fits your remaining terms at a normal load.',
  'FAILED_COURSE_TO_RETAKE' => 'A required course is below its pass mark and needs a retake.',
  'INCOMPLETE_TO_RESOLVE' => 'An incomplete course needs to be resolved.',
  'HEAVY_LOAD_NEEDED' =>
    'Finishing on time needs about ${_credits(perTerm)} credits a term, more than a normal load.',
  'MULTIPLE_FAILED_COURSES' => 'Several required courses are below their pass marks.',
  'CANNOT_FINISH_IN_TIME' =>
    'Finishing on time would need about ${_credits(perTerm)} credits a term, more than the maximum load.',
  'PAST_EXPECTED_GRADUATION' =>
    'Your expected graduation term has passed with requirements still open.',
  _ => sentenceCase(reason),
};

String reasonLabel(String reason) => switch (reason) {
  'NOT_TAKEN' => 'Not yet taken',
  'FAILED' => 'Below the pass mark, so a retake is needed',
  'IN_PROGRESS' => 'In progress this term',
  'INCOMPLETE' => 'Incomplete, needs resolving',
  'ELECTIVE_SLOT_OPEN' => 'Elective credits still needed',
  'AFRICAN_STUDIES_MISSING' => 'African Studies course needed',
  'CREDIT_SHORTFALL' => 'Total credits short',
  _ => sentenceCase(reason),
};

String stateLabel(RequirementState state) => switch (state) {
  RequirementState.completed => 'Completed',
  RequirementState.inProgress => 'In progress',
  RequirementState.failed => 'Below pass mark',
  RequirementState.incomplete => 'Incomplete',
  RequirementState.notStarted => 'Remaining',
};

String actionLabel(String kind) => switch (kind) {
  'RETAKE' => 'Retake',
  'RESOLVE_INCOMPLETE' => 'Resolve',
  'TAKE_COURSE' => 'Take',
  'CHOOSE_ELECTIVE' => 'Choose',
  _ => sentenceCase(kind),
};

String describeIssue(String code) {
  final parts = code.split(':');
  final course = parts.length > 1 ? parts[1] : '';
  return switch (parts.first) {
    'CURRICULUM_UNAVAILABLE' =>
      'Your programme’s curriculum has not been reviewed by the Registry yet.',
    'UNKNOWN_GRADE' => 'A grade for $course is not on the grade scale.',
    'UNKNOWN_STATUS' => 'The status of $course is not recognised.',
    'INVALID_CREDITS' => 'The credits recorded for $course are not valid.',
    _ => sentenceCase(code),
  };
}

String trackLabel(String track) => switch (track) {
  'pre-calculus' => 'Pre-calculus',
  'calculus-1-2' => 'Calculus 1 and 2',
  _ => 'Standard',
};

String credits(double value) =>
    value == value.roundToDouble() ? value.toInt().toString() : value.toString();

String _credits(double? value) => credits(value ?? 0);

String sentenceCase(String code) {
  final words = code.toLowerCase().replaceAll('_', ' ');
  return words.isEmpty ? words : words[0].toUpperCase() + words.substring(1);
}
