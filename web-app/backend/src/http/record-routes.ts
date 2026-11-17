import { randomBytes } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { hashPassword } from '../auth/passwords.js';
import type { AppConfig } from '../config.js';
import { courseCodeSchema, courseRecordSchema, firstIssue, studentDetailsSchema, studentUpdateSchema } from '../records/schemas.js';
import type { AuditAction, AuditEntry, CourseAttempt, Repositories, StudentSummary } from '../repositories/types.js';
import { asyncHandler, requirePermission } from './middleware.js';

const studentIdSchema = z.string().regex(/^[\w-]{1,64}$/);

const attemptsSummary = (attempts: CourseAttempt[] | undefined) =>
  attempts?.length ? attempts.map(attempt => attempt.grade ?? attempt.status.toLowerCase()).join(' > ') : 'none';

/**
 * Manual create and edit of single student and course records (data management).
 * Like CSV imports, it never changes synthetic records, which belong to the seeding workflow.
 */
export function recordRoutes(config: AppConfig, repositories: Repositories, now: () => Date): Router {
  const router = Router();
  const audit = (req: Request, action: AuditAction, subject: string, metadata: AuditEntry['metadata']) =>
    repositories.auditLog.append({ action, actorId: req.auth?.sub, actorRole: req.auth?.role, subject, metadata, requestId: req.requestId, ip: req.ip, at: now() });
  const invalid = (res: Response, message: string) => { res.status(400).json({ error: 'INVALID_INPUT', message }); };

  /** Resolves an editable (real) student, or answers the request with the reason it cannot be edited. */
  const editableStudent = async (req: Request, res: Response): Promise<StudentSummary | undefined> => {
    const parsed = studentIdSchema.safeParse(req.params.studentId);
    const student = parsed.success ? await repositories.students.findById(parsed.data) : undefined;
    if (!student) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return undefined;
    }
    if (student.synthetic) {
      res.status(409).json({ error: 'SYNTHETIC_RECORD', message: 'Synthetic records are managed by the seeding workflow and cannot be edited here.' });
      return undefined;
    }
    return student;
  };

  router.post('/students', requirePermission('records:edit'), asyncHandler(async (req, res) => {
    const studentId = z.string().trim().safeParse(req.body?.studentId);
    const details = studentDetailsSchema.safeParse(req.body);
    if (!studentId.success || !config.studentIdPattern.test(studentId.data)) return invalid(res, 'That is not a valid student ID.');
    if (!details.success) return invalid(res, firstIssue(details.error));
    if (await repositories.students.findById(studentId.data)) {
      res.status(409).json({ error: 'STUDENT_EXISTS', message: `${studentId.data} already exists. Open it from Student lookup to edit it.` });
      return;
    }
    const student: StudentSummary = { studentId: studentId.data, ...details.data };
    await repositories.students.upsert(student);
    // As with imports, the account starts with an unknowable password until an admin issues a temporary one.
    const placeholderHash = await hashPassword(randomBytes(32).toString('base64url'));
    const accountCreated = await repositories.users.createIfAbsent({ identifier: student.studentId, studentId: student.studentId, role: 'STUDENT', passwordHash: placeholderHash, forcePasswordChange: true, failedLogins: 0 });
    await audit(req, 'ADMIN_STUDENT_CREATED', student.studentId, { programme: student.programme, yearGroup: student.yearGroup, track: student.track, accountCreated });
    res.status(201).json({ student, accountCreated });
  }));

  router.patch('/students/:studentId', requirePermission('records:edit'), asyncHandler(async (req, res) => {
    const changes = studentUpdateSchema.safeParse(req.body);
    if (!changes.success) return invalid(res, firstIssue(changes.error));
    const student = await editableStudent(req, res);
    if (!student) return;
    const updated = { ...student, ...changes.data };
    const changed = (Object.keys(changes.data) as Array<keyof typeof changes.data>).filter(key => student[key] !== updated[key]);
    if (changed.length > 0) {
      await repositories.students.upsert(updated);
      await audit(req, 'ADMIN_STUDENT_UPDATED', student.studentId, Object.fromEntries(changed.flatMap(key => [[key, updated[key]], [`previous.${key}`, student[key]]])));
    }
    res.json({ student: updated, changed });
  }));

  router.put('/students/:studentId/courses/:courseCode', requirePermission('records:edit'), asyncHandler(async (req, res) => {
    const courseCode = courseCodeSchema.safeParse(req.params.courseCode);
    const record = courseRecordSchema.safeParse(req.body);
    if (!courseCode.success) return invalid(res, firstIssue(courseCode.error));
    if (!record.success) return invalid(res, firstIssue(record.error));
    const student = await editableStudent(req, res);
    if (!student) return;
    const previous = (await repositories.students.listCourses(student.studentId)).find(course => course.courseCode === courseCode.data);
    await repositories.students.setCourse(student.studentId, courseCode.data, record.data.attempts);
    await audit(req, 'ADMIN_COURSE_RECORD_UPDATED', student.studentId, { courseCode: courseCode.data, attempts: attemptsSummary(record.data.attempts), previous: attemptsSummary(previous?.attempts) });
    res.status(previous ? 200 : 201).json({ course: { courseCode: courseCode.data, attempts: record.data.attempts } });
  }));

  router.delete('/students/:studentId/courses/:courseCode', requirePermission('records:edit'), asyncHandler(async (req, res) => {
    const courseCode = courseCodeSchema.safeParse(req.params.courseCode);
    if (!courseCode.success) return invalid(res, firstIssue(courseCode.error));
    const student = await editableStudent(req, res);
    if (!student) return;
    const previous = (await repositories.students.listCourses(student.studentId)).find(course => course.courseCode === courseCode.data);
    if (!previous) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    await repositories.students.setCourse(student.studentId, courseCode.data, null);
    await audit(req, 'ADMIN_COURSE_RECORD_REMOVED', student.studentId, { courseCode: courseCode.data, previous: attemptsSummary(previous.attempts) });
    res.status(204).end();
  }));

  return router;
}
