import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AuthService } from '../auth/service.js';
import { assessEligibility } from '../eligibility/assess.js';
import { curriculumFor } from '../eligibility/curriculum.js';
import { REGISTER_FLAGS, REGISTER_SORTS, buildRegister, filterAndSort, registerCsv, registerRows } from '../register/register.js';
import type { AuditAction, AuditEntry, Repositories } from '../repositories/types.js';
import { asyncHandler, contextOf, requirePermission } from './middleware.js';

const searchSchema = z.object({ q: z.string().trim().max(64).regex(/^[\w-]*$/).default('') });
const studentIdSchema = z.string().regex(/^[\w-]{1,64}$/);
const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().regex(/^[A-Z_]+$/).optional()
});
const registerSchema = z.object({
  programme: z.string().regex(/^[A-Z]{2,6}$/).optional(),
  yearGroup: z.coerce.number().int().min(2000).max(2100).optional(),
  flag: z.enum(REGISTER_FLAGS).optional(),
  sort: z.enum(REGISTER_SORTS).default('studentId'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(200).default(50)
});
const resetSchema = z.object({ identifier: z.string().trim().min(3).max(64) });

export function adminRoutes(repositories: Repositories, auth: AuthService, now: () => Date): Router {
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

  router.get('/students/:studentId/eligibility', requirePermission('student:read:any'), asyncHandler(async (req, res) => {
    const parsed = studentIdSchema.safeParse(req.params.studentId);
    const student = parsed.success ? await repositories.students.findById(parsed.data) : undefined;
    if (!student) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    const [courses, curriculum] = await Promise.all([repositories.students.listCourses(student.studentId), curriculumFor(student, repositories)]);
    await audit(req, 'ADMIN_ELIGIBILITY_VIEWED', student.studentId);
    res.json(assessEligibility(student, courses, curriculum, now()));
  }));

  const loadRegister = async (filter: { programme?: string; yearGroup?: number }) => {
    const students = await repositories.students.list(filter);
    return { students, summaries: await repositories.students.courseSummaries(students.map(student => student.studentId)) };
  };
  const registerFilters = (query: z.infer<typeof registerSchema>) =>
    Object.fromEntries(Object.entries({ programme: query.programme, yearGroup: query.yearGroup, flag: query.flag }).filter(([, value]) => value !== undefined)) as Record<string, string | number>;

  router.get('/register', requirePermission('student:read:any'), asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_INPUT' });
      return;
    }
    const { students, summaries } = await loadRegister(parsed.data);
    const page = buildRegister(students, summaries, parsed.data);
    await audit(req, 'ADMIN_REGISTER_VIEWED', undefined, { ...registerFilters(parsed.data), page: page.page });
    res.json(page);
  }));

  router.get('/register.csv', requirePermission('student:read:any'), asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_INPUT' });
      return;
    }
    const { students, summaries } = await loadRegister(parsed.data);
    const rows = filterAndSort(registerRows(students, summaries), parsed.data);
    await audit(req, 'ADMIN_REGISTER_EXPORTED', undefined, { ...registerFilters(parsed.data), rows: rows.length });
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', 'attachment; filename="student-register.csv"');
    res.setHeader('cache-control', 'no-store');
    res.send(`\uFEFF${registerCsv(rows)}`);
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
