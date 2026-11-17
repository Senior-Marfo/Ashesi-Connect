import type { NextAction, RemainingReason, RequirementState, StandingLevel, StandingReason } from './api';

const issueLabels: Record<string, string> = {
  CURRICULUM_UNAVAILABLE: 'Your programme’s curriculum has not been reviewed by the Registry yet.',
  NO_REQUIREMENTS: 'No requirements are available yet.'
};

export function describeIssue(code: string): string {
  const [kind, course] = code.split(':');
  if (kind === 'UNKNOWN_GRADE') return `A grade for ${course} is not on the grade scale.`;
  if (kind === 'UNKNOWN_STATUS') return `The status of ${course} is not recognised.`;
  if (kind === 'INVALID_CREDITS') return `The credits recorded for ${course} are not valid.`;
  return issueLabels[code] ?? sentenceCase(code);
}

export const reasonLabels: Record<RemainingReason, string> = {
  NOT_TAKEN: 'Not yet taken',
  FAILED: 'Below the pass mark, so a retake is needed',
  IN_PROGRESS: 'In progress this term',
  INCOMPLETE: 'Incomplete, needs resolving',
  ELECTIVE_SLOT_OPEN: 'Elective credits still needed',
  AFRICAN_STUDIES_MISSING: 'African Studies course needed',
  CREDIT_SHORTFALL: 'Total credits short'
};

export const standingLabels: Record<StandingLevel, string> = { GREEN: 'On track', YELLOW: 'At risk', RED: 'Critical' };

export function describeStandingReason(reason: StandingReason, perTerm: number | null): string {
  switch (reason) {
    case 'REQUIREMENTS_MET': return 'Every listed requirement is met.';
    case 'ON_TRACK': return 'What remains fits your remaining terms at a normal load.';
    case 'FAILED_COURSE_TO_RETAKE': return 'A required course is below its pass mark and needs a retake.';
    case 'INCOMPLETE_TO_RESOLVE': return 'An incomplete course needs to be resolved.';
    case 'HEAVY_LOAD_NEEDED': return `Finishing on time needs about ${perTerm ?? 0} credits a term, more than a normal load.`;
    case 'MULTIPLE_FAILED_COURSES': return 'Several required courses are below their pass marks.';
    case 'CANNOT_FINISH_IN_TIME': return `Finishing on time would need about ${perTerm ?? 0} credits a term, more than the maximum load.`;
    case 'PAST_EXPECTED_GRADUATION': return 'Your expected graduation term has passed with requirements still open.';
  }
}

export const stateLabels: Record<RequirementState, string> = {
  COMPLETED: 'Completed', IN_PROGRESS: 'In progress', FAILED: 'Below pass mark', INCOMPLETE: 'Incomplete', NOT_STARTED: 'Remaining'
};

export const actionLabels: Record<NextAction['kind'], string> = {
  RETAKE: 'Retake', RESOLVE_INCOMPLETE: 'Resolve', TAKE_COURSE: 'Take', CHOOSE_ELECTIVE: 'Choose'
};

export function sentenceCase(code: string): string {
  const words = code.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
