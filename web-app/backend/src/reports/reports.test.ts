import { describe, expect, it } from 'vitest';
import type { EligibilityView } from '../eligibility/assess.js';
import type { CourseRecord } from '../repositories/types.js';
import { buildReports, type ReportStudent } from './reports.js';

function student(id: string, yearGroup: number, programme: string, outcome: 'met' | 'short' | 'none', graduated: boolean, courses: CourseRecord[] = []): ReportStudent {
  const audit = outcome === 'none' ? null : {
    creditsEarned: outcome === 'met' ? 36 : 30, creditsRequired: 36, creditsInProgress: 0, percentComplete: outcome === 'met' ? 100 : 83.33,
    remainingRequirements: outcome === 'met' ? [] : [
      { code: 'CS 400', category: 'Capstone', credits: 1, reason: 'NOT_TAKEN' as const },
      { code: 'MATH 141', category: 'Maths', credits: 1, reason: 'FAILED' as const },
      { code: 'TOTAL_CREDITS', category: 'Overall', credits: 6, reason: 'CREDIT_SHORTFALL' as const }
    ]
  };
  const assessment: EligibilityView = {
    student: { studentId: id, fullName: id, programme, yearGroup, track: 'standard' },
    officialCertification: false,
    status: outcome === 'none' ? 'NO_CURRICULUM' : outcome === 'met' ? 'REQUIREMENTS_MET' : 'REQUIREMENTS_REMAINING',
    curriculum: outcome === 'none' ? null : { basis: 'SYNTHETIC', version: 'SYNTHETIC-1' },
    expectedGraduation: `${yearGroup} Spring`, audit,
    standing: outcome === 'none' ? null : { level: outcome === 'met' ? 'GREEN' : 'RED', reasons: [], creditsOutstanding: 0, termsRemaining: 0, creditsPerTermNeeded: null },
    requirements: [], nextActions: [], issues: []
  };
  return { assessment, courses, graduated };
}

const course = (courseCode: string, ...grades: string[]): CourseRecord => ({ courseCode, attempts: grades.map(grade => ({ credits: 1, grade, status: 'COMPLETED' as const })) });

describe('reports', () => {
  const reports = buildReports([
    student('a', 2025, 'CS', 'met', true, [course('CS 111', 'A'), course('MATH 141', 'E', 'B')]),
    student('b', 2025, 'CS', 'short', true, [course('CS 111', 'B'), course('MATH 141', 'D')]),
    student('c', 2025, 'BA', 'met', true, [course('CS 111', 'C')]),
    student('d', 2025, 'BA', 'none', true),
    student('e', 2028, 'CS', 'met', false, [course('CS 111', 'A+')]),
    student('f', 2028, 'BA', 'short', false)
  ]);

  it('reports completion for graduated cohorts only, among assessed students, with reasons', () => {
    expect(reports.totals).toEqual({ students: 6, assessed: 5, graduatedCohorts: [2025] });
    expect(reports.cohortOutcomes).toHaveLength(1);
    expect(reports.cohortOutcomes[0]).toMatchObject({ yearGroup: 2025, students: 4, assessed: 3, requirementsMet: 2, completionRate: 66.7 });
    expect(reports.cohortOutcomes[0].reasons).toMatchObject({ CAPSTONE_OUTSTANDING: 1, FAILED_COURSE: 1, CREDIT_SHORTFALL: 1, ELECTIVES_SHORT: 0 });
  });

  it('tracks progress and standing for cohorts still studying', () => {
    expect(reports.cohortProgress).toEqual([{ yearGroup: 2028, students: 2, assessed: 2, averagePercentComplete: 91.7, standings: { RED: 1, YELLOW: 0, GREEN: 1, UNDETERMINED: 0 } }]);
    expect(reports.standings).toEqual({ RED: 2, YELLOW: 0, GREEN: 3, UNDETERMINED: 1 });
  });

  it('compares programmes on credits, completion and standing', () => {
    expect(reports.programmes.map(p => p.programme)).toEqual(['BA', 'CS']);
    expect(reports.programmes[1]).toMatchObject({ students: 3, completionRate: 50, standings: { GREEN: 2, RED: 1 } });
    expect(reports.programmes[1].averagePassedCredits).toBe(1.3);
  });

  it('computes course pass rates on the first attempt, retakes and grade distributions', () => {
    const maths = reports.courses.find(c => c.courseCode === 'MATH 141')!;
    expect(maths).toMatchObject({ students: 2, attempts: 3, firstAttemptPassRate: 0, unresolvedFailures: 1, retakes: 1 });
    expect(maths.grades).toMatchObject({ E: 1, D: 1, B: 1, A: 0 });
    expect(reports.courses.find(c => c.courseCode === 'CS 111')).toMatchObject({ students: 4, firstAttemptPassRate: 100 });
  });

  it('handles an empty selection', () => {
    expect(buildReports([])).toMatchObject({ totals: { students: 0, assessed: 0, graduatedCohorts: [] }, cohortOutcomes: [], programmes: [], courses: [] });
  });
});
