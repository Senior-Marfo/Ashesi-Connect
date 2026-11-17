import { describe, expect, it } from 'vitest';
import { applyPassMarks, meetsGrade, passesCourse, passingGradesByCourse, type PassMarks } from './pass-marks.js';
import { evaluateProgramme, type ProgrammeRules } from './programme-audit.js';

const marks: PassMarks = new Map([['CS 400', 'C'], ['CS 351', 'C'], ['MATH 141', 'D+']]);
const rules: ProgrammeRules = {
  programme: 'CS', track: 'standard', totalCredits: 3, verifiedByRegistry: false,
  requiredCourses: [
    { courseCode: 'CS 400', credits: 1, minimumGrade: 'D+', category: 'Capstone' },
    { courseCode: 'MATH 141', credits: 1, minimumGrade: 'C', category: 'Core' }
  ],
  electivePools: [{ category: 'Major Electives', creditsRequired: 1, courseCodes: ['CS 351', 'CS 352'] }]
};

describe('pass marks', () => {
  it('compares grades on the scale and rejects unknown grades', () => {
    expect(meetsGrade('C', 'C')).toBe(true);
    expect(meetsGrade('D+', 'C')).toBe(false);
    expect(meetsGrade('A+', 'D+')).toBe(true);
    expect(meetsGrade('P', 'D+')).toBe(false);
    expect(meetsGrade(undefined, 'D+')).toBe(false);
  });

  it('uses the catalogue pass mark, and D+ for courses without one', () => {
    expect(passesCourse('CS 400', 'D+', marks)).toBe(false);
    expect(passesCourse('CS 400', 'C', marks)).toBe(true);
    expect(passesCourse('ECON 101', 'D+', marks)).toBe(true);
    expect(passesCourse('ECON 101', 'D', marks)).toBe(false);
  });

  it('groups passing grades by course for database queries', () => {
    const grouped = passingGradesByCourse(marks);
    expect(grouped.fallback).toEqual(['D+', 'C', 'C+', 'B', 'B+', 'A', 'A+']);
    expect(grouped.overrides).toEqual([
      { courseCodes: ['CS 400', 'CS 351'], grades: ['C', 'C+', 'B', 'B+', 'A', 'A+'] },
      { courseCodes: ['MATH 141'], grades: ['D+', 'C', 'C+', 'B', 'B+', 'A', 'A+'] }
    ]);
    expect(passingGradesByCourse(new Map()).overrides).toEqual([]);
  });

  it('overrides curriculum pass marks for required and elective courses, raising or lowering them', () => {
    const applied = applyPassMarks(rules, marks);
    expect(applied.requiredCourses.map(rule => [rule.courseCode, rule.minimumGrade])).toEqual([['CS 400', 'C'], ['MATH 141', 'D+']]);
    expect(applied.electivePools[0].courseMinimums).toEqual({ 'CS 351': 'C' });
    expect(applyPassMarks(rules, new Map())).toBe(rules);

    const transcript = [
      { courseCode: 'CS 400', grade: 'D+' as const, attempt: 1, credits: 1 },
      { courseCode: 'MATH 141', grade: 'D+' as const, attempt: 1, credits: 1 },
      { courseCode: 'CS 351', grade: 'D+' as const, attempt: 1, credits: 1 }
    ];
    const audit = evaluateProgramme(transcript, applied);
    expect(audit.remainingRequirements.map(item => [item.code, item.reason])).toEqual([
      ['CS 400', 'FAILED'], ['Major Electives', 'ELECTIVE_SLOT_OPEN'], ['TOTAL_CREDITS', 'CREDIT_SHORTFALL']
    ]);
    expect(audit.creditsEarned).toBe(1);
  });
});
