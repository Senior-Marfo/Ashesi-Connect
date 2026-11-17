import { describe, expect, it } from 'vitest';
import { validateCurriculum } from '../domain/eligibility/curriculum-version.js';
import { evaluateProgramme } from '../domain/eligibility/programme-audit.js';
import { mapEnrollmentTranscript } from '../domain/eligibility/transcript-mapping.js';
import { SYNTHETIC_CURRICULUM_VERSION, syntheticProgrammeRules } from './synthetic-curriculum.js';
import { PROGRAMMES, generateSyntheticDataset } from './synthetic-data.js';

const dataset = generateSyntheticDataset({ today: new Date('2026-11-17T00:00:00Z') });
const tracks = ['standard', 'pre-calculus', 'calculus-1-2'];

describe('synthetic programme rules', () => {
  it('pass curriculum validation apart from the deliberately missing official provenance', () => {
    for (const programme of PROGRAMMES) for (const track of tracks) {
      const rules = syntheticProgrammeRules(programme, track);
      expect(rules).toBeDefined();
      const { issues } = validateCurriculum({ rules: rules!, sources: [], version: SYNTHETIC_CURRICULUM_VERSION, status: 'DRAFT' });
      expect(issues).toEqual(['NO_POLICY_PROVENANCE']);
    }
  });

  it('cover every course a synthetic student takes, as a required course or an elective option', () => {
    for (const student of dataset.students) {
      const rules = syntheticProgrammeRules(student.programme, student.track)!;
      const known = new Set([...rules.requiredCourses.map(course => course.courseCode), ...rules.electivePools.flatMap(pool => pool.courseCodes)]);
      for (const enrollment of dataset.enrollments.filter(e => e.studentId === student.studentId)) expect(known.has(enrollment.courseCode)).toBe(true);
    }
  });

  it('total roughly the credit loads printed for the real programmes (34 to 41)', () => {
    for (const programme of PROGRAMMES) {
      const total = syntheticProgrammeRules(programme, 'standard')!.totalCredits;
      expect(total).toBeGreaterThanOrEqual(34);
      expect(total).toBeLessThanOrEqual(41);
    }
  });

  it('let most graduated synthetic students meet every requirement (about a real graduation rate) and leave a minority short', () => {
    const graduated = dataset.students.filter(student => student.yearGroup === 2025);
    const complete = graduated.filter(student => {
      const transcript = mapEnrollmentTranscript(dataset.enrollments.filter(e => e.studentId === student.studentId));
      return evaluateProgramme(transcript.entries, syntheticProgrammeRules(student.programme, student.track)!).remainingRequirements.length === 0;
    }).length;
    expect(complete / graduated.length).toBeGreaterThan(0.75);
    expect(complete).toBeLessThan(graduated.length);
  });

  it('is unavailable for unknown programmes', () => {
    expect(syntheticProgrammeRules('ART', 'standard')).toBeUndefined();
  });
});
