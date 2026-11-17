import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Repositories, StudentSummary } from '../repositories/types.js';
import { asyncHandler, requirePermission } from './middleware.js';

const studentIdSchema = z.string().regex(/^[\w-]{1,64}$/);
const noteSchema = z.object({ body: z.string().trim().min(1).max(2000) });

/** US-06: the staff-only parts of an admin's student profile — notes, message history and audit exports. */
export function studentProfileRoutes(repositories: Repositories, now: () => Date): Router {
  const router = Router();

  const findStudent = async (req: Request): Promise<StudentSummary | undefined> => {
    const parsed = studentIdSchema.safeParse(req.params.studentId);
    return parsed.success ? repositories.students.findById(parsed.data) : undefined;
  };
  const audit = (req: Request, action: 'ADMIN_STUDENT_NOTE_ADDED' | 'ADMIN_AUDIT_EXPORTED', subject: string) =>
    repositories.auditLog.append({ action, actorId: req.auth?.sub, actorRole: req.auth?.role, subject, requestId: req.requestId, ip: req.ip, at: now() });

  router.get('/:studentId/notes', requirePermission('student:read:any'), asyncHandler(async (req, res) => {
    const student = await findStudent(req);
    if (!student) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    const notes = await repositories.notes.listFor(student.studentId, 100);
    const authorIds = [...new Set(notes.map(note => note.authorId))];
    const authors = new Map((await Promise.all(authorIds.map(id => repositories.users.findById(id)))).flatMap(user => (user ? [[user.id, user.identifier] as const] : [])));
    res.json({ notes: notes.map(({ authorId, ...note }) => ({ ...note, author: authors.get(authorId) ?? 'Removed account' })) });
  }));

  router.post('/:studentId/notes', requirePermission('student:note:write'), asyncHandler(async (req, res) => {
    const student = await findStudent(req);
    const parsed = noteSchema.safeParse(req.body);
    if (!student) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    if (!parsed.success || !req.auth) {
      res.status(400).json({ error: 'INVALID_INPUT' });
      return;
    }
    const note = await repositories.notes.add({ studentId: student.studentId, body: parsed.data.body, authorId: req.auth.sub, createdAt: now() });
    await audit(req, 'ADMIN_STUDENT_NOTE_ADDED', student.studentId);
    const author = await repositories.users.findById(req.auth.sub);
    const { authorId: _authorId, ...rest } = note;
    res.status(201).json({ note: { ...rest, author: author?.identifier ?? 'Removed account' } });
  }));

  router.get('/:studentId/messages', requirePermission('student:read:any'), asyncHandler(async (req, res) => {
    const student = await findStudent(req);
    if (!student) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    res.json({ messages: await repositories.messages.inbox(student.studentId, 50, now()) });
  }));

  router.post('/:studentId/audit-export', requirePermission('student:read:any'), asyncHandler(async (req, res) => {
    const student = await findStudent(req);
    if (!student) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    await audit(req, 'ADMIN_AUDIT_EXPORTED', student.studentId);
    res.status(204).end();
  }));

  return router;
}
