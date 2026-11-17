import type { DetailedAudit } from './programme-audit.js';

/** Severity thresholds (docs/03-design/severity-model.md). */
export interface StandingConfig {
  /** Credits a student normally completes per term. */
  normalLoad: number;
  /** Most credits a student may take in one term. */
  maxLoad: number;
  /** Failed required courses (not yet retaken) that make standing critical. */
  criticalFailedCourses: number;
}

export const DEFAULT_STANDING_CONFIG: StandingConfig = { normalLoad: 5, maxLoad: 6, criticalFailedCourses: 3 };

export type StandingLevel = 'GREEN' | 'YELLOW' | 'RED';
export type StandingReason =
  | 'REQUIREMENTS_MET' | 'ON_TRACK'
  | 'FAILED_COURSE_TO_RETAKE' | 'INCOMPLETE_TO_RESOLVE' | 'HEAVY_LOAD_NEEDED'
  | 'MULTIPLE_FAILED_COURSES' | 'CANNOT_FINISH_IN_TIME' | 'PAST_EXPECTED_GRADUATION';

export interface Standing {
  level: StandingLevel;
  reasons: StandingReason[];
  /** Credits still to start after everything currently in progress is passed. */
  creditsOutstanding: number;
  termsRemaining: number;
  /** Credits per remaining term needed to finish on time; null when no terms remain. */
  creditsPerTermNeeded: number | null;
}

const RED_REASONS: ReadonlySet<StandingReason> = new Set(['MULTIPLE_FAILED_COURSES', 'CANNOT_FINISH_IN_TIME', 'PAST_EXPECTED_GRADUATION']);
const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Advisory standing from a programme audit. It assumes courses in progress will be
 * passed; it is never an official graduation decision.
 */
export function assessStanding(
  audit: DetailedAudit,
  context: { creditsInProgress: number; termsRemaining: number },
  config: StandingConfig = DEFAULT_STANDING_CONFIG
): Standing {
  const { termsRemaining } = context;
  const creditsOutstanding = round(Math.max(0, audit.creditsRequired - audit.creditsEarned - context.creditsInProgress));
  const creditsPerTermNeeded = termsRemaining > 0 ? round(creditsOutstanding / termsRemaining) : null;
  const base = { creditsOutstanding, termsRemaining, creditsPerTermNeeded };
  if (audit.remainingRequirements.length === 0) return { level: 'GREEN', reasons: ['REQUIREMENTS_MET'], ...base };

  const failed = audit.remainingRequirements.filter(item => item.reason === 'FAILED').length;
  const incomplete = audit.remainingRequirements.filter(item => item.reason === 'INCOMPLETE').length;
  const unfinishedBeyondCurrentTerm = audit.remainingRequirements.some(item => item.reason !== 'IN_PROGRESS') && (creditsOutstanding > 0 || failed + incomplete > 0 || audit.remainingRequirements.some(item => item.reason === 'NOT_TAKEN'));

  const reasons: StandingReason[] = [];
  if (termsRemaining === 0 && unfinishedBeyondCurrentTerm) reasons.push('PAST_EXPECTED_GRADUATION');
  else if (creditsOutstanding > termsRemaining * config.maxLoad) reasons.push('CANNOT_FINISH_IN_TIME');
  else if (creditsOutstanding > termsRemaining * config.normalLoad) reasons.push('HEAVY_LOAD_NEEDED');
  if (failed >= config.criticalFailedCourses) reasons.push('MULTIPLE_FAILED_COURSES');
  if (failed > 0) reasons.push('FAILED_COURSE_TO_RETAKE');
  if (incomplete > 0) reasons.push('INCOMPLETE_TO_RESOLVE');

  if (reasons.length === 0) return { level: 'GREEN', reasons: ['ON_TRACK'], ...base };
  return { level: reasons.some(reason => RED_REASONS.has(reason)) ? 'RED' : 'YELLOW', reasons, ...base };
}
