import { randomBytes } from 'node:crypto';
import { hashPassword } from '../auth/passwords.js';
import type { ImportBatch, ImportKind, Repositories, UndoStep } from '../repositories/types.js';
import { validateCourses, validateStudents, type RowError } from './validate.js';

export interface ImportPreview {
  kind: ImportKind;
  rows: number;
  created: number;
  updated: number;
  errorCount: number;
  /** The first errors, for display; errorCount has the total. */
  errors: RowError[];
}

const ERROR_LIMIT = 200;

interface Plan { preview: ImportPreview; apply: (actor: string, filename: string, now: Date) => Promise<ImportBatch> }

/**
 * Validates a whole file against the current records before anything is written.
 * Real imports never touch synthetic records, and vice versa.
 */
export async function planImport(kind: ImportKind, text: string, repositories: Repositories, studentIdPattern: RegExp): Promise<Plan> {
  const finish = (rows: number, created: number, updated: number, errors: RowError[], apply: Plan['apply']): Plan => ({
    preview: { kind, rows, created, updated, errorCount: errors.length, errors: errors.slice(0, ERROR_LIMIT) },
    apply
  });
  const refuse: Plan['apply'] = async () => { throw new Error('IMPORT_HAS_ERRORS'); };

  if (kind === 'STUDENTS') {
    const { students, errors } = validateStudents(text, studentIdPattern);
    const existing = new Map((await Promise.all(students.map(student => repositories.students.findById(student.studentId)))).flatMap(found => (found ? [[found.studentId, found] as const] : [])));
    for (const [studentId, found] of existing) if (found.synthetic) errors.push({ row: 0, column: 'studentId', message: `${studentId} belongs to a synthetic record; remove synthetic records before importing real ones.` });
    const created = students.filter(student => !existing.has(student.studentId)).length;
    return finish(students.length, created, students.length - created, errors, errors.length ? refuse : async (actor, filename, now) => {
      const undo: UndoStep[] = [];
      // Accounts start with an unknowable password; an admin issues a temporary one when the student needs access.
      const placeholderHash = await hashPassword(randomBytes(32).toString('base64url'));
      for (const student of students) {
        undo.push({ type: 'student', studentId: student.studentId, before: existing.get(student.studentId) ?? null });
        await repositories.students.upsert(student);
        const account = await repositories.users.createIfAbsent({ identifier: student.studentId, studentId: student.studentId, role: 'STUDENT', passwordHash: placeholderHash, forcePasswordChange: true, failedLogins: 0 });
        if (account) undo.push({ type: 'account', identifier: student.studentId });
      }
      return repositories.imports.create({ kind, filename, createdBy: actor, createdAt: now, rows: students.length, created, updated: students.length - created, status: 'APPLIED', undo });
    });
  }

  const { courses, errors } = validateCourses(text);
  const studentIds = [...new Set(courses.map(course => course.studentId))];
  const students = new Map((await Promise.all(studentIds.map(id => repositories.students.findById(id)))).flatMap(found => (found ? [[found.studentId, found] as const] : [])));
  for (const id of studentIds) {
    if (!students.has(id)) errors.push({ row: 0, column: 'studentId', message: `${id} is not a known student; import students first.` });
    else if (students.get(id)?.synthetic) errors.push({ row: 0, column: 'studentId', message: `${id} is a synthetic record and cannot receive imported courses.` });
  }
  const current = await repositories.students.coursesFor(studentIds);
  const before = (studentId: string, courseCode: string) => current.get(studentId)?.find(course => course.courseCode === courseCode)?.attempts ?? null;
  const created = courses.filter(course => before(course.studentId, course.courseCode) === null).length;
  const rows = courses.reduce((sum, course) => sum + course.attempts.length, 0);
  return finish(rows, created, courses.length - created, errors, errors.length ? refuse : async (actor, filename, now) => {
    const undo: UndoStep[] = [];
    for (const course of courses) {
      undo.push({ type: 'course', studentId: course.studentId, courseCode: course.courseCode, before: before(course.studentId, course.courseCode) });
      await repositories.students.setCourse(course.studentId, course.courseCode, course.attempts);
    }
    return repositories.imports.create({ kind, filename, createdBy: actor, createdAt: now, rows, created, updated: courses.length - created, status: 'APPLIED', undo });
  });
}

/** Undoes a batch, newest change first. Only the most recent applied batch can be undone, so later imports never build on undone data. */
export async function rollbackImport(batchId: string, repositories: Repositories, now: Date): Promise<'ROLLED_BACK' | 'NOT_FOUND' | 'NOT_LATEST'> {
  const batch = await repositories.imports.find(batchId);
  if (!batch || batch.status !== 'APPLIED') return 'NOT_FOUND';
  if ((await repositories.imports.latestApplied())?.id !== batch.id) return 'NOT_LATEST';
  for (const step of [...batch.undo].reverse()) {
    if (step.type === 'account') await repositories.users.removeByIdentifier(step.identifier);
    else if (step.type === 'student') {
      if (step.before) await repositories.students.upsert(step.before);
      else await repositories.students.remove(step.studentId);
    } else await repositories.students.setCourse(step.studentId, step.courseCode, step.before);
  }
  await repositories.imports.markRolledBack(batch.id, now);
  return 'ROLLED_BACK';
}
