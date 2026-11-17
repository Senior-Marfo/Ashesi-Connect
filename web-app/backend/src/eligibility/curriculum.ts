import type { Repositories, StudentSummary } from '../repositories/types.js';
import { SYNTHETIC_CURRICULUM_VERSION, syntheticProgrammeRules } from '../seed/synthetic-curriculum.js';
import type { AppliedCurriculum } from './assess.js';

/**
 * Real students are assessed only against a Registry-reviewed curriculum. Synthetic
 * students use the illustrative synthetic rules, which never apply to real records.
 */
export async function curriculumFor(student: StudentSummary, repositories: Repositories): Promise<AppliedCurriculum | undefined> {
  if (student.synthetic) {
    const rules = syntheticProgrammeRules(student.programme, student.track);
    return rules ? { basis: 'SYNTHETIC', version: SYNTHETIC_CURRICULUM_VERSION, rules } : undefined;
  }
  const reviewed = await repositories.curricula.findReviewed(student.programme, student.track, student.yearGroup);
  return reviewed ? { basis: 'REVIEWED', version: reviewed.version, rules: { ...reviewed.rules, verifiedByRegistry: false } } : undefined;
}
