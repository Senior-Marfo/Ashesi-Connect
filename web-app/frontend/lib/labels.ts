import type { RemainingReason } from './api';

const issueLabels: Record<string, string> = {
  CURRICULUM_UNAVAILABLE: 'Your programme’s curriculum has not been reviewed yet.',
  NO_APPLICABLE_CURRICULUM: 'No reviewed curriculum applies to your year group yet.',
  AMBIGUOUS_COHORT_CURRICULUM: 'More than one curriculum matches your year group; the Registry must resolve this.',
  INVALID_COHORT_YEAR: 'Your year group on record needs correcting.',
  TRANSCRIPT_UNAVAILABLE: 'No courses are on record yet.',
  NO_USABLE_TRANSCRIPT_ENTRIES: 'No courses are on record yet.',
  EMPTY_COURSE_CODE: 'A course on your record has no course code.',
  UNSUPPORTED_GRADE: 'A grade on your record is not on the supported grade scale.',
  INVALID_CURRICULUM_OR_TRANSCRIPT: 'Your record could not be compared with the curriculum.',
  NO_GRADED_CREDITS: 'No graded credits yet.',
  REPEAT_GPA_POLICY_UNVERIFIED: 'Repeated courses are not counted until the repeat policy is confirmed.',
  INVALID_GPA_ENTRY: 'A course could not be included in the GPA.'
};

export function describeIssue(code: string): string {
  return issueLabels[code] ?? sentenceCase(code);
}

export const reasonLabels: Record<RemainingReason, string> = {
  NOT_TAKEN: 'Not yet taken',
  FAILED: 'Below the pass mark — retake needed',
  IN_PROGRESS: 'In progress',
  INCOMPLETE: 'Incomplete',
  ELECTIVE_SLOT_OPEN: 'Elective credits still needed',
  AFRICAN_STUDIES_MISSING: 'African Studies course needed',
  CREDIT_SHORTFALL: 'Total credits short'
};

export function sentenceCase(code: string): string {
  const words = code.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
