import { describe, expect, it } from 'vitest';
import type { ProgrammeRules, TranscriptEntry } from './programme-audit.js';
import { requirementBreakdown } from './requirement-breakdown.js';

const rules: ProgrammeRules = {
  programme: 'CS', track: 'standard', totalCredits: 8, verifiedByRegistry: false,
  requiredCourses: [
    { courseCode: 'WRIT 111', credits: 1, minimumGrade: 'D+', category: 'Core' },
    { courseCode: 'CS 400', credits: 1, minimumGrade: 'C', category: 'Capstone' },
    { courseCode: 'CS 212', credits: 1, minimumGrade: 'D+', category: 'Major' },
    { courseCode: 'CS 221', credits: 1, minimumGrade: 'D+', category: 'Major' },
    { courseCode: 'MATH 141', credits: 1, minimumGrade: 'D+', category: 'Core' }
  ],
  electivePools: [{ category: 'Major Electives', creditsRequired: 2, courseCodes: ['CS 351', 'CS 352', 'CS 361'] }]
};
const transcript: TranscriptEntry[] = [
  { courseCode: 'WRIT 111', grade: 'E', attempt: 1, credits: 1 },
  { courseCode: 'WRIT 111', grade: 'B', attempt: 2, credits: 1 },
  { courseCode: 'CS 400', grade: 'D+', attempt: 1, credits: 1 },
  { courseCode: 'CS 212', status: 'IN_PROGRESS', attempt: 1, credits: 1 },
  { courseCode: 'MATH 141', status: 'INCOMPLETE', attempt: 1, credits: 1 },
  { courseCode: 'CS 351', grade: 'D', attempt: 1, credits: 1 }
];

describe('requirement breakdown', () => {
  const groups = requirementBreakdown(transcript, rules);
  const item = (code: string) => groups.flatMap(group => group.items).find(entry => entry.code === code);

  it('groups required courses by category in rule order, then elective pools', () => {
    expect(groups.map(group => [group.category, group.kind])).toEqual([['Core', 'REQUIRED'], ['Capstone', 'REQUIRED'], ['Major', 'REQUIRED'], ['Major Electives', 'ELECTIVE']]);
  });

  it('reports each requirement state with retakes and per-course pass marks', () => {
    expect(item('WRIT 111')).toMatchObject({ state: 'COMPLETED', grade: 'B', attempts: 2 });
    expect(item('CS 400')).toMatchObject({ state: 'FAILED', grade: 'D+', minimumGrade: 'C' });
    expect(item('CS 212')?.state).toBe('IN_PROGRESS');
    expect(item('CS 221')).toMatchObject({ state: 'NOT_STARTED', attempts: 0 });
    expect(item('MATH 141')?.state).toBe('INCOMPLETE');
  });

  it('totals credits per group and lists untaken elective options', () => {
    expect(groups[0]).toMatchObject({ creditsRequired: 2, creditsCompleted: 1, creditsInProgress: 0 });
    expect(groups[2]).toMatchObject({ creditsRequired: 2, creditsCompleted: 0, creditsInProgress: 1 });
    expect(groups[3]).toMatchObject({ creditsRequired: 2, creditsCompleted: 1, options: ['CS 352', 'CS 361'] });
    expect(item('CS 351')).toMatchObject({ state: 'COMPLETED', minimumGrade: 'D' });
  });
});
