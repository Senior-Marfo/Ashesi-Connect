import { Router } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { generateTemporaryPassword, hashPassword } from '../auth/passwords.js';
import { PASS_MARK_GRADES } from '../domain/eligibility/pass-marks.js';
import { COURSE_CODE } from '../imports/validate.js';
import type { Repositories } from '../repositories/types.js';
import { asyncHandler, requirePermission } from './middleware.js';

const standingSchema = z.object({
  normalLoad: z.number().min(1).max(10).multipleOf(0.5),
  maxLoad: z.number().min(1).max(10).multipleOf(0.5),
  criticalFailedCourses: z.number().int().min(1).max(20)
}).refine(value => value.maxLoad >= value.normalLoad, { message: 'The maximum load must be at least the normal load.' });

const courseCodeSchema = z.string().trim().toUpperCase().regex(COURSE_CODE);
const passMarkSchema = z.object({
  minimumGrade: z.enum(PASS_MARK_GRADES),
  note: z.string().trim().max(500).optional().transform(note => note || undefined)
});

export function settingsRoutes(config: AppConfig, repositories: Repositories, now: () => Date): Router {
  const router = Router();

  router.get('/', requirePermission('settings:manage'), asyncHandler(async (_req, res) => {
    res.json(await repositories.settings.get());
  }));

  router.put('/standing', requirePermission('settings:manage'), asyncHandler(async (req, res) => {
    const parsed = standingSchema.safeParse(req.body);
    if (!parsed.success || !req.auth) {
      res.status(400).json({ error: 'INVALID_INPUT', message: parsed.success ? undefined : parsed.error.issues[0]?.message });
      return;
    }
    const at = now();
    const previous = (await repositories.settings.get()).standing;
    await repositories.settings.update({ standing: parsed.data, updatedAt: at, updatedBy: req.auth.sub });
    await repositories.auditLog.append({
      action: 'ADMIN_SETTINGS_UPDATED', actorId: req.auth.sub, actorRole: req.auth.role, subject: 'standing',
      metadata: Object.fromEntries(Object.entries(parsed.data).flatMap(([key, value]) => [[key, value], [`previous.${key}`, previous[key as keyof typeof previous]]])),
      requestId: req.requestId, ip: req.ip, at
    });
    res.json(await repositories.settings.get());
  }));

  router.get('/admins', requirePermission('user:manage'), asyncHandler(async (_req, res) => {
    res.json({ admins: await repositories.users.listByRole('ADMIN') });
  }));

  router.post('/admins', requirePermission('user:manage'), asyncHandler(async (req, res) => {
    const parsed = z.object({ identifier: z.string().trim().min(3).max(64) }).safeParse(req.body);
    if (!parsed.success || !req.auth) {
      res.status(400).json({ error: 'INVALID_INPUT' });
      return;
    }
    if (!config.staffIdPattern.test(parsed.data.identifier)) {
      res.status(400).json({ error: 'INVALID_STAFF_ID', message: 'That is not a valid staff ID.' });
      return;
    }
    const temporaryPassword = generateTemporaryPassword();
    const created = await repositories.users.createIfAbsent({ identifier: parsed.data.identifier, role: 'ADMIN', passwordHash: await hashPassword(temporaryPassword), forcePasswordChange: true, failedLogins: 0 });
    if (!created) {
      res.status(409).json({ error: 'ACCOUNT_EXISTS', message: 'An account with that ID already exists.' });
      return;
    }
    await repositories.auditLog.append({
      action: 'ADMIN_USER_CREATED', actorId: req.auth.sub, actorRole: req.auth.role, subject: parsed.data.identifier,
      requestId: req.requestId, ip: req.ip, at: now()
    });
    res.setHeader('cache-control', 'no-store');
    res.status(201).json({ identifier: parsed.data.identifier, temporaryPassword });
  }));

  router.get('/pass-marks', requirePermission('settings:manage'), asyncHandler(async (_req, res) => {
    const marks = await repositories.passMarks.list();
    const authors = new Map((await Promise.all([...new Set(marks.map(mark => mark.updatedBy))].map(id => repositories.users.findById(id))))
      .flatMap(user => (user ? [[user.id, user.identifier] as const] : [])));
    res.json({ defaultMinimumGrade: 'D+', passMarks: marks.map(({ updatedBy, ...mark }) => ({ ...mark, updatedBy: authors.get(updatedBy) ?? 'Removed account' })) });
  }));

  router.put('/pass-marks/:courseCode', requirePermission('settings:manage'), asyncHandler(async (req, res) => {
    const courseCode = courseCodeSchema.safeParse(req.params.courseCode);
    const body = passMarkSchema.safeParse(req.body);
    if (!courseCode.success || !body.success || !req.auth) {
      res.status(400).json({ error: 'INVALID_INPUT', message: courseCode.success ? 'Choose D+ or C.' : 'Course codes look like "MATH 141".' });
      return;
    }
    const previous = await repositories.passMarks.find(courseCode.data);
    const at = now();
    await repositories.passMarks.set({ courseCode: courseCode.data, ...body.data, updatedBy: req.auth.sub, updatedAt: at });
    await repositories.auditLog.append({
      action: 'ADMIN_PASS_MARK_UPDATED', actorId: req.auth.sub, actorRole: req.auth.role, subject: courseCode.data,
      metadata: { minimumGrade: body.data.minimumGrade, previous: previous?.minimumGrade ?? 'default D+' },
      requestId: req.requestId, ip: req.ip, at
    });
    res.json({ courseCode: courseCode.data, minimumGrade: body.data.minimumGrade });
  }));

  router.delete('/pass-marks/:courseCode', requirePermission('settings:manage'), asyncHandler(async (req, res) => {
    const courseCode = courseCodeSchema.safeParse(req.params.courseCode);
    const previous = courseCode.success ? await repositories.passMarks.find(courseCode.data) : undefined;
    if (!courseCode.success || !previous || !req.auth) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    await repositories.passMarks.remove(courseCode.data);
    await repositories.auditLog.append({
      action: 'ADMIN_PASS_MARK_UPDATED', actorId: req.auth.sub, actorRole: req.auth.role, subject: courseCode.data,
      metadata: { minimumGrade: 'default D+', previous: previous.minimumGrade },
      requestId: req.requestId, ip: req.ip, at: now()
    });
    res.status(204).end();
  }));

  return router;
}
