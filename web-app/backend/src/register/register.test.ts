import { describe, expect, it } from 'vitest';
import type { CourseSummary, StudentSummary } from '../repositories/types.js';
import { buildRegister, registerCsv, registerRows } from './register.js';

const student = (studentId: string, fullName: string, extra: Partial<StudentSummary> = {}): StudentSummary =>
  ({ studentId, fullName, programme: 'CS', yearGroup: 2028, track: 'standard', ...extra });
const summary = (studentId: string, extra: Partial<CourseSummary>): CourseSummary =>
  ({ studentId, coursesOnRecord: 10, passedCredits: 10, inProgressCredits: 0, unresolvedFailures: 0, incompletes: 0, ...extra });

const students = [student('1', 'Ama'), student('2', 'Kofi'), student('3', 'Esi'), student('4', 'Yaw')];
const summaries = [
  summary('1', { passedCredits: 20, unresolvedFailures: 2 }),
  summary('2', { passedCredits: 25, incompletes: 1 }),
  summary('3', { passedCredits: 15, unresolvedFailures: 1, incompletes: 1 })
];
const base = { sort: 'studentId' as const, order: 'asc' as const, page: 1, pageSize: 50 };

describe('student register', () => {
  it('derives factual flags and leaves severity undetermined', () => {
    const rows = registerRows(students, summaries);
    expect(rows.map(row => row.flags)).toEqual([['UNRESOLVED_FAILURE'], ['INCOMPLETE'], ['UNRESOLVED_FAILURE', 'INCOMPLETE'], ['NO_RECORDS']]);
    expect(rows.every(row => row.severity === 'UNDETERMINED')).toBe(true);
    expect(rows[3]).toMatchObject({ coursesOnRecord: 0, passedCredits: 0 });
  });

  it('counts every flag across all students, independent of the flag filter', () => {
    const page = buildRegister(students, summaries, { ...base, flag: 'INCOMPLETE' });
    expect(page.counts).toEqual({ students: 4, UNRESOLVED_FAILURE: 2, INCOMPLETE: 2, NO_RECORDS: 1 });
    expect(page.rows.map(row => row.studentId)).toEqual(['2', '3']);
    expect(page.total).toBe(2);
  });

  it('sorts numbers numerically, text alphabetically, ties by student ID', () => {
    expect(buildRegister(students, summaries, { ...base, sort: 'passedCredits', order: 'desc' }).rows.map(row => row.studentId)).toEqual(['2', '1', '3', '4']);
    expect(buildRegister(students, summaries, { ...base, sort: 'fullName' }).rows.map(row => row.fullName)).toEqual(['Ama', 'Esi', 'Kofi', 'Yaw']);
    expect(buildRegister(students, summaries, { ...base, sort: 'yearGroup' }).rows.map(row => row.studentId)).toEqual(['1', '2', '3', '4']);
  });

  it('paginates and clamps pages past the end', () => {
    const page = buildRegister(students, summaries, { ...base, pageSize: 3, page: 9 });
    expect(page).toMatchObject({ page: 2, pageCount: 2, total: 4 });
    expect(page.rows.map(row => row.studentId)).toEqual(['4']);
    expect(buildRegister([], [], base)).toMatchObject({ page: 1, pageCount: 1, total: 0, rows: [] });
  });

  it('exports CSV with escaping and formula protection', () => {
    const rows = registerRows([student('9', '=HYPERLINK("x")'), student('8', 'Mensah, Ama "Ami"', { synthetic: true })], []);
    const lines = registerCsv(rows).split('\r\n');
    expect(lines[0]).toContain('Passed credits (provisional D+ pass mark)');
    expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(lines[2]).toContain('"Mensah, Ama ""Ami"""');
    expect(lines[2].endsWith(',yes')).toBe(true);
  });
});
