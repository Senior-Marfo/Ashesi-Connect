import 'package:ashesi_graduation_tracker/models/json.dart';
import 'package:ashesi_graduation_tracker/models/student.dart';

enum StandingLevel { green, yellow, red }

enum RequirementState { completed, inProgress, failed, incomplete, notStarted }

enum EligibilityStatus { noCurriculum, dataIssues, requirementsMet, requirementsRemaining }

class Standing {
  const Standing({
    required this.level,
    required this.reasons,
    required this.creditsOutstanding,
    required this.termsRemaining,
    this.creditsPerTermNeeded,
  });

  factory Standing.fromJson(Json json) => Standing(
    level: switch (str(json, 'level')) {
      'RED' => StandingLevel.red,
      'YELLOW' => StandingLevel.yellow,
      _ => StandingLevel.green,
    },
    reasons: strings(json, 'reasons'),
    creditsOutstanding: num_(json, 'creditsOutstanding'),
    termsRemaining: int_(json, 'termsRemaining'),
    creditsPerTermNeeded: numOrNull(json, 'creditsPerTermNeeded'),
  );

  final StandingLevel level;
  final List<String> reasons;
  final double creditsOutstanding;
  final int termsRemaining;
  final double? creditsPerTermNeeded;
}

class RemainingItem {
  const RemainingItem({
    required this.code,
    required this.category,
    required this.credits,
    required this.reason,
  });

  factory RemainingItem.fromJson(Json json) => RemainingItem(
    code: str(json, 'code'),
    category: str(json, 'category'),
    credits: num_(json, 'credits'),
    reason: str(json, 'reason'),
  );

  final String code;
  final String category;
  final double credits;
  final String reason;
}

class Audit {
  const Audit({
    required this.creditsEarned,
    required this.creditsRequired,
    required this.creditsInProgress,
    required this.percentComplete,
    required this.remaining,
  });

  factory Audit.fromJson(Json json) => Audit(
    creditsEarned: num_(json, 'creditsEarned'),
    creditsRequired: num_(json, 'creditsRequired'),
    creditsInProgress: num_(json, 'creditsInProgress'),
    percentComplete: num_(json, 'percentComplete'),
    remaining: objects(json, 'remainingRequirements').map(RemainingItem.fromJson).toList(),
  );

  final double creditsEarned;
  final double creditsRequired;
  final double creditsInProgress;
  final double percentComplete;
  final List<RemainingItem> remaining;
}

class RequirementItem {
  const RequirementItem({
    required this.code,
    required this.credits,
    required this.minimumGrade,
    required this.state,
    required this.attempts,
    this.grade,
  });

  factory RequirementItem.fromJson(Json json) => RequirementItem(
    code: str(json, 'code'),
    credits: num_(json, 'credits'),
    minimumGrade: str(json, 'minimumGrade', 'D+'),
    state: switch (str(json, 'state')) {
      'COMPLETED' => RequirementState.completed,
      'IN_PROGRESS' => RequirementState.inProgress,
      'FAILED' => RequirementState.failed,
      'INCOMPLETE' => RequirementState.incomplete,
      _ => RequirementState.notStarted,
    },
    attempts: int_(json, 'attempts'),
    grade: strOrNull(json, 'grade'),
  );

  final String code;
  final double credits;
  final String minimumGrade;
  final RequirementState state;
  final int attempts;
  final String? grade;
}

class RequirementGroup {
  const RequirementGroup({
    required this.category,
    required this.elective,
    required this.creditsRequired,
    required this.creditsCompleted,
    required this.creditsInProgress,
    required this.items,
    required this.options,
  });

  factory RequirementGroup.fromJson(Json json) => RequirementGroup(
    category: str(json, 'category'),
    elective: str(json, 'kind') == 'ELECTIVE',
    creditsRequired: num_(json, 'creditsRequired'),
    creditsCompleted: num_(json, 'creditsCompleted'),
    creditsInProgress: num_(json, 'creditsInProgress'),
    items: objects(json, 'items').map(RequirementItem.fromJson).toList(),
    options: strings(json, 'options'),
  );

  final String category;
  final bool elective;
  final double creditsRequired;
  final double creditsCompleted;
  final double creditsInProgress;
  final List<RequirementItem> items;
  final List<String> options;
}

class NextAction {
  const NextAction({
    required this.kind,
    required this.code,
    required this.category,
    required this.credits,
  });

  factory NextAction.fromJson(Json json) => NextAction(
    kind: str(json, 'kind'),
    code: str(json, 'code'),
    category: str(json, 'category'),
    credits: num_(json, 'credits'),
  );

  final String kind;
  final String code;
  final String category;
  final double credits;
}

/// The advisory graduation assessment. Never an official audit or Registry certification.
class Eligibility {
  const Eligibility({
    required this.student,
    required this.status,
    required this.expectedGraduation,
    required this.requirements,
    required this.nextActions,
    required this.issues,
    this.curriculumVersion,
    this.syntheticRules = false,
    this.audit,
    this.standing,
  });

  factory Eligibility.fromJson(Json json) {
    final curriculum = json['curriculum'] is Json ? json['curriculum'] as Json : null;
    return Eligibility(
      student: StudentSummary.fromJson(
        json['student'] is Json ? json['student'] as Json : const {},
      ),
      status: switch (str(json, 'status')) {
        'REQUIREMENTS_MET' => EligibilityStatus.requirementsMet,
        'REQUIREMENTS_REMAINING' => EligibilityStatus.requirementsRemaining,
        'DATA_ISSUES' => EligibilityStatus.dataIssues,
        _ => EligibilityStatus.noCurriculum,
      },
      expectedGraduation: str(json, 'expectedGraduation'),
      curriculumVersion: curriculum == null ? null : str(curriculum, 'version'),
      syntheticRules: curriculum != null && str(curriculum, 'basis') == 'SYNTHETIC',
      audit: json['audit'] is Json ? Audit.fromJson(json['audit'] as Json) : null,
      standing: json['standing'] is Json ? Standing.fromJson(json['standing'] as Json) : null,
      requirements: objects(json, 'requirements').map(RequirementGroup.fromJson).toList(),
      nextActions: objects(json, 'nextActions').map(NextAction.fromJson).toList(),
      issues: strings(json, 'issues'),
    );
  }

  final StudentSummary student;
  final EligibilityStatus status;
  final String expectedGraduation;
  final String? curriculumVersion;
  final bool syntheticRules;
  final Audit? audit;
  final Standing? standing;
  final List<RequirementGroup> requirements;
  final List<NextAction> nextActions;
  final List<String> issues;

  /// Course code → pass mark, from the requirement tree.
  Map<String, String> get passMarks => {
    for (final group in requirements)
      for (final item in group.items) item.code: item.minimumGrade,
  };
}
