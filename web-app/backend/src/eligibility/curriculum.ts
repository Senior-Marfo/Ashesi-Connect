import { applyPassMarks, type PassMarks } from '../domain/eligibility/pass-marks.js';
import type { Repositories, StudentSummary } from '../repositories/types.js';
import { SYNTHETIC_CURRICULUM_VERSION, syntheticProgrammeRules } from '../seed/synthetic-curriculum.js';
import type { AppliedCurriculum } from './assess.js';

/**
 * Real students are assessed only against a Registry-reviewed curriculum. Synthetic
 * students use the illustrative synthetic rules, which never apply to real records.
 * Either way, the course pass-mark catalogue overrides the pass marks in the rules.
 */
export async function curriculumFor(student: StudentSummary, repositories: Repositories, passMarks: PassMarks): Promise<AppliedCurriculum | undefined> {
  if (student.synthetic) {
    const rules = syntheticProgrammeRules(student.programme, student.track);
    return rules ? { basis: 'SYNTHETIC', version: SYNTHETIC_CURRICULUM_VERSION, rules: applyPassMarks(rules, passMarks) } : undefined;
  }
  const reviewed = await repositories.curricula.findReviewed(student.programme, student.track, student.yearGroup);
  return reviewed ? { basis: 'REVIEWED', version: reviewed.version, rules: applyPassMarks({ ...reviewed.rules, verifiedByRegistry: false }, passMarks) } : undefined;
}

/** The pass-mark catalogue as a lookup by course code. */
export async function loadPassMarks(repositories: Repositories): Promise<PassMarks> {
  return new Map((await repositories.passMarks.list()).map(mark => [mark.courseCode, mark.minimumGrade]));
}
