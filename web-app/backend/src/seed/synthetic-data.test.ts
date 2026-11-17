import { describe, expect, it } from 'vitest';
import { PROGRAMMES, generateSyntheticDataset } from './synthetic-data.js';

const today = new Date('2026-11-17T00:00:00Z');
const dataset = generateSyntheticDataset({ today });

describe('synthetic dataset', () => {
  it('is deterministic for the same seed and date', () => {
    expect(generateSyntheticDataset({ today })).toEqual(dataset);
    expect(generateSyntheticDataset({ today, seed: 7 }).students[0]).not.toEqual(dataset.students[0]);
  });

  it('spreads 600 students evenly over every programme and year group', () => {
    expect(dataset.students).toHaveLength(600);
    for (const programme of PROGRAMMES) expect(dataset.students.filter(s => s.programme === programme)).toHaveLength(60);
    for (const yearGroup of [2025, 2026, 2027, 2028, 2029, 2030]) expect(dataset.students.filter(s => s.yearGroup === yearGroup)).toHaveLength(100);
  });

  it('uses unique IDs in the reserved 9xxxxxxx range that match the default student ID format', () => {
    const ids = dataset.students.map(s => s.studentId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^9\d{7}$/);
    expect(dataset.students.every(s => s.synthetic) && dataset.enrollments.every(e => e.synthetic)).toBe(true);
  });

  it('links every enrollment to a generated student, once per course', () => {
    const ids = new Set(dataset.students.map(s => s.studentId));
    const keys = dataset.enrollments.map(e => `${e.studentId}|${e.courseCode}`);
    expect(dataset.enrollments.every(e => ids.has(e.studentId))).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('places attempts on the right side of today: past cohorts finished, current cohorts enrolled in Fall 2026', () => {
    const byStudent = (yearGroup: number) => new Set(dataset.students.filter(s => s.yearGroup === yearGroup).map(s => s.studentId));
    const graduated = byStudent(2026);
    const current = byStudent(2028);
    const attemptsOf = (ids: Set<string>) => dataset.enrollments.filter(e => ids.has(e.studentId)).flatMap(e => e.attempts);
    expect(attemptsOf(graduated).some(a => a.status === 'ENROLLED')).toBe(false);
    const ongoing = attemptsOf(current).filter(a => a.status === 'ENROLLED');
    expect(ongoing.length).toBeGreaterThan(0);
    expect(ongoing.every(a => a.semester === '2026 Fall' && a.grade === undefined)).toBe(true);
    expect(attemptsOf(current).some(a => a.semester === '2027 Spring')).toBe(false);
  });

  it('includes realistic failures followed by later retakes', () => {
    const retaken = dataset.enrollments.filter(e => e.attempts.length > 1);
    expect(retaken.length).toBeGreaterThan(20);
    for (const record of retaken) {
      expect(['D', 'E']).toContain(record.attempts[0].grade);
      expect(record.attempts[1].semester).not.toBe(record.attempts[0].semester);
    }
  });

  it('gives graduated cohorts a full load of roughly 30 to 40 credits', () => {
    const graduated = dataset.students.filter(s => s.yearGroup === 2025).map(s => s.studentId);
    const credits = graduated.map(id => dataset.enrollments.filter(e => e.studentId === id).reduce((sum, e) => sum + e.attempts[0].credits, 0));
    const average = credits.reduce((a, b) => a + b, 0) / credits.length;
    expect(average).toBeGreaterThan(30);
    expect(average).toBeLessThan(42);
  });
});
