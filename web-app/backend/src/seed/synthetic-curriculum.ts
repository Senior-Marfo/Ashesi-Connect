import type { ProgrammeRules } from '../domain/eligibility/programme-audit.js';
import {
  AFRICAN_STUDIES_OPTIONS, ELECTIVE_COUNTS, NON_MAJOR_OPTIONS, PROGRAMMES, majorElectiveOptions, requiredSegments, type Programme
} from './synthetic-data.js';

export const SYNTHETIC_CURRICULUM_VERSION = 'SYNTHETIC-1';

/**
 * Programme rules matching the illustrative synthetic course plans. They exist only so
 * synthetic students can exercise the eligibility screens; they are never applied to
 * real students and are not the official Ashesi curriculum.
 */
export function syntheticProgrammeRules(programme: string, track: string): ProgrammeRules | undefined {
  if (!(PROGRAMMES as readonly string[]).includes(programme)) return undefined;
  const code = programme as Programme;
  const segments = requiredSegments(code, track);
  const required = [...segments.beforeAfricanStudies, ...segments.beforeNonMajor, ...segments.beforeElectives, ...segments.final];
  const electivePools = [
    { category: 'Major Electives', creditsRequired: ELECTIVE_COUNTS.major, courseCodes: majorElectiveOptions(code) },
    { category: 'Non-Major Electives', creditsRequired: ELECTIVE_COUNTS.nonMajor, courseCodes: [...NON_MAJOR_OPTIONS] },
    { category: 'African Studies', creditsRequired: ELECTIVE_COUNTS.africanStudies, courseCodes: [...AFRICAN_STUDIES_OPTIONS] }
  ];
  const totalCredits = required.reduce((sum, course) => sum + course.credits, 0) + electivePools.reduce((sum, pool) => sum + pool.creditsRequired, 0);
  return {
    programme,
    track,
    totalCredits,
    verifiedByRegistry: false,
    requiredCourses: required.map(course => ({ courseCode: course.code, credits: course.credits, minimumGrade: course.minimumGrade, category: course.category })),
    electivePools
  };
}
