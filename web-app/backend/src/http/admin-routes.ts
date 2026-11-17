import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AuthService } from '../auth/service.js';
import type { AuditAction, AuditEntry, Repositories } from '../repositories/types.js';
import { asyncHandler, contextOf, requirePermission } from './middleware.js';

const searchSchema = z.object({ q: z.string().trim().max(64).regex(/^[\w-]*$/).default('') });
const studentIdSchema = z.string().regex(/^[\w-]{1,64}$/);
const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().regex(/^[A-Z_]+$/).optional()
});
const resetSchema = z.object({ identifier: z.string().trim().min(3).max(64) });

export function adminRoutes(repositories: Repositories, auth: AuthService): Router {
  const router = Router();

  const audit = (req: Request, action: AuditAction, subject?: string, metadata?: AuditEntry['metadata']) =>
    repositories.auditLog.append({
      action, actorId: req.auth?.sub, actorRole: req.auth?.role, subject, metadata,
      requestId: req.requestId, ip: req.ip, at: new Date()
    });

  router.get('/students', requirePermission('student:read:any'), asyncHandler(async (req, res) => {
    const parsed = searchSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_INPUT' });
      return;
    }
    const students = await repositories.students.searchByIdPrefix(parsed.data.q, 50);
    await audit(req, 'ADMIN_STUDENT_SEARCHED', undefined, { query: parsed.data.q, results: students.length });
    res.json({ students });
  }));

  router.get('/students/:studentId', requirePermission('student:read:any'), asyncHandler(async (req, res) => {
    const parsed = studentIdSchema.safeParse(req.params.studentId);
    const student = parsed.success ? await repositories.students.findById(parsed.data) : undefined;
    if (!parsed.success || !student) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    await audit(req, 'ADMIN_STUDENT_VIEWED', student.studentId);
    res.json({ student, courses: await repositories.students.listCourses(student.studentId) });
  }));

  router.post('/users/reset-password', requirePermission('user:reset-password'), asyncHandler(async (req, res) => {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success || !req.auth) {
      res.status(400).json({ error: 'INVALID_INPUT' });
      return;
    }
    const temporaryPassword = await auth.resetPassword({ id: req.auth.sub, role: req.auth.role }, parsed.data.identifier, contextOf(req));
    res.setHeader('cache-control', 'no-store');
    res.json({ temporaryPassword, passwordChangeRequired: true });
  }));

  router.get('/audit-log', requirePermission('audit-log:read'), asyncHandler(async (req, res) => {
    const parsed = auditQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_INPUT' });
      return;
    }
    const entries = await repositories.auditLog.list({ limit: parsed.data.limit, action: parsed.data.action as AuditAction | undefined });
    await audit(req, 'ADMIN_AUDIT_LOG_VIEWED');
    res.json({ entries });
  }));

  return router;
}
