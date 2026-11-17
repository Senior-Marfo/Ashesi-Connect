import { GRADE_SCALE, PROGRAMMES, TRACKS } from '../domain/programmes.js';
import type { CourseAttempt, StudentSummary } from '../repositories/types.js';
import { csvRecords } from './csv.js';

export interface RowError { row: number; column?: string; message: string }
export const MAX_ROWS = 20_000;

export const IMPORT_COLUMNS = {
  STUDENTS: { required: ['studentid', 'fullname', 'programme', 'yeargroup'], optional: ['track'] },
  COURSES: { required: ['studentid', 'coursecode', 'credits'], optional: ['grade', 'status', 'semester'] }
} as const;

export const COURSE_CODE = /^[A-Z]{2,5} \d{3}[A-Z]?$/;
const SEMESTER = /^\d{4} (Fall|Spring|Summer)$/;

/** Row numbers match the spreadsheet: the header is row 1. */
function readTable(text: string, kind: keyof typeof IMPORT_COLUMNS) {
  let parsed;
  try {
    parsed = csvRecords(text);
  } catch {
    return { records: [], errors: [{ row: 0, message: 'The file is not valid CSV: a quoted field is never closed.' }] };
  }
  const missing = IMPORT_COLUMNS[kind].required.filter(column => !parsed.headers.includes(column));
  if (missing.length) return { records: [], errors: [{ row: 1, message: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}` }] };
  if (parsed.records.length === 0) return { records: [], errors: [{ row: 0, message: 'The file has no data rows.' }] };
  if (parsed.records.length > MAX_ROWS) return { records: [], errors: [{ row: 0, message: `The file has ${parsed.records.length} rows; the limit is ${MAX_ROWS}. Split it into smaller files.` }] };
  return { records: parsed.records, errors: [] as RowError[] };
}

export function validateStudents(text: string, studentIdPattern: RegExp): { students: StudentSummary[]; errors: RowError[] } {
  const { records, errors } = readTable(text, 'STUDENTS');
  const students: StudentSummary[] = [];
  const seen = new Map<string, number>();
  records.forEach((record, index) => {
    const row = index + 2;
    const fail = (column: string, message: string) => errors.push({ row, column, message });
    const studentId = record.studentid;
    const programme = record.programme.toUpperCase();
    const yearGroup = Number(record.yeargroup);
    const track = (record.track || 'standard').toLowerCase();
    let valid = true;
    if (!studentIdPattern.test(studentId)) { fail('studentId', `“${studentId}” is not a valid student ID.`); valid = false; }
    else if (seen.has(studentId)) { fail('studentId', `Duplicate of row ${seen.get(studentId)}.`); valid = false; }
    if (!record.fullname || record.fullname.length > 120) { fail('fullName', 'A name of 1 to 120 characters is required.'); valid = false; }
    if (!(PROGRAMMES as readonly string[]).includes(programme)) { fail('programme', `“${record.programme}” is not a programme (${PROGRAMMES.join(', ')}).`); valid = false; }
    if (!Number.isInteger(yearGroup) || yearGroup < 2000 || yearGroup > 2100) { fail('yearGroup', `“${record.yeargroup}” is not a year group.`); valid = false; }
    if (!(TRACKS as readonly string[]).includes(track)) { fail('track', `“${record.track}” is not a track (${TRACKS.join(', ')}).`); valid = false; }
    seen.set(studentId, row);
    if (valid) students.push({ studentId, fullName: record.fullname, programme, yearGroup, track });
  });
  return { students, errors };
}

export interface CourseImport { studentId: string; courseCode: string; attempts: CourseAttempt[] }

/** Rows for the same student and course become that course's attempts, in file order. */
export function validateCourses(text: string): { courses: CourseImport[]; errors: RowError[] } {
  const { records, errors } = readTable(text, 'COURSES');
  const courses = new Map<string, CourseImport>();
  records.forEach((record, index) => {
    const row = index + 2;
    const fail = (column: string, message: string) => errors.push({ row, column, message });
    const courseCode = record.coursecode.toUpperCase().replace(/\s+/g, ' ').replace(/^([A-Z]+)(\d)/, '$1 $2');
    const credits = Number(record.credits);
    const grade = (record.grade ?? '').toUpperCase();
    const rawStatus = (record.status ?? '').toUpperCase().replace(/[\s_-]+/g, '');
    const status = rawStatus === '' ? (grade ? 'COMPLETED' : '') : rawStatus === 'INPROGRESS' ? 'ENROLLED' : rawStatus;
    const semester = record.semester ?? '';
    let valid = true;
    if (!/^[\w-]{1,64}$/.test(record.studentid)) { fail('studentId', 'A student ID is required.'); valid = false; }
    if (!COURSE_CODE.test(courseCode)) { fail('courseCode', `“${record.coursecode}” is not a course code like CS 111.`); valid = false; }
    if (!Number.isFinite(credits) || credits <= 0 || credits > 4 || Math.round(credits * 2) !== credits * 2) { fail('credits', `“${record.credits}” is not a credit value (0.5 steps up to 4).`); valid = false; }
    if (grade && !(GRADE_SCALE as readonly string[]).includes(grade)) { fail('grade', `“${record.grade}” is not on the grade scale (${GRADE_SCALE.join(', ')}).`); valid = false; }
    if (!['COMPLETED', 'ENROLLED', 'INCOMPLETE'].includes(status)) { fail('status', status ? `“${record.status}” is not a status (completed, enrolled, incomplete).` : 'Give a grade or a status.'); valid = false; }
    else if (status === 'COMPLETED' && !grade) { fail('grade', 'A completed course needs a grade.'); valid = false; }
    else if (status !== 'COMPLETED' && grade) { fail('grade', `A course that is ${status.toLowerCase()} cannot have a grade.`); valid = false; }
    if (semester && !SEMESTER.test(semester)) { fail('semester', `“${semester}” is not a term like 2025 Fall.`); valid = false; }
    if (!valid) return;
    const key = `${record.studentid}|${courseCode}`;
    const entry = courses.get(key) ?? { studentId: record.studentid, courseCode, attempts: [] };
    entry.attempts.push({ credits, status: status as CourseAttempt['status'], ...(grade ? { grade } : {}), ...(semester ? { semester } : {}) });
    courses.set(key, entry);
  });
  return { courses: [...courses.values()], errors };
}
