import { describe, expect, it } from 'vitest';
import { validateCourses, validateStudents } from './validate.js';

const ID = /^\d{8}$/;

describe('student import validation', () => {
  it('accepts valid rows, defaulting the track and upper-casing the programme', () => {
    const result = validateStudents('studentId,fullName,programme,yearGroup\n20280001,Ama Mensah,cs,2028', ID);
    expect(result).toEqual({ errors: [], students: [{ studentId: '20280001', fullName: 'Ama Mensah', programme: 'CS', yearGroup: 2028, track: 'standard' }] });
  });
  it('reports every problem with spreadsheet row numbers', () => {
    const { errors } = validateStudents('studentId,fullName,programme,yearGroup,track\nABC,,ART,soon,fast\n20280001,A,CS,2028,standard\n20280001,B,CS,2028,standard', ID);
    expect(errors.filter(e => e.row === 2).map(e => e.column)).toEqual(['studentId', 'fullName', 'programme', 'yearGroup', 'track']);
    expect(errors).toContainEqual({ row: 4, column: 'studentId', message: 'Duplicate of row 3.' });
  });
  it('names missing columns', () => {
    expect(validateStudents('studentId,fullName\n1,2', ID).errors).toEqual([{ row: 1, message: 'Missing columns: programme, yeargroup' }]);
  });
});

describe('course import validation', () => {
  it('groups rows into attempts in file order and infers status from the grade', () => {
    const { courses, errors } = validateCourses('studentId,courseCode,credits,grade,status,semester\n20280001,math141,1,E,,2024 Fall\n20280001,MATH 141,1,B,,2025 Spring\n20280001,CS 415,1,,in progress,2026 Fall');
    expect(errors).toEqual([]);
    expect(courses).toEqual([
      { studentId: '20280001', courseCode: 'MATH 141', attempts: [{ credits: 1, status: 'COMPLETED', grade: 'E', semester: '2024 Fall' }, { credits: 1, status: 'COMPLETED', grade: 'B', semester: '2025 Spring' }] },
      { studentId: '20280001', courseCode: 'CS 415', attempts: [{ credits: 1, status: 'ENROLLED', semester: '2026 Fall' }] }
    ]);
  });
  it('rejects bad codes, credits, grades and contradictory statuses', () => {
    const { errors } = validateCourses('studentId,courseCode,credits,grade,status,semester\n1,C,0.3,P,,Fall\n1,CS 111,1,,completed,\n1,CS 112,1,A,enrolled,\n1,CS 113,1,,,');
    expect(errors.map(e => [e.row, e.column])).toEqual([[2, 'courseCode'], [2, 'credits'], [2, 'grade'], [2, 'semester'], [3, 'grade'], [4, 'grade'], [5, 'status']]);
  });
});
