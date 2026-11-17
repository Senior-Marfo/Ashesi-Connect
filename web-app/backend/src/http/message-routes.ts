import { Router } from 'express';
import { z } from 'zod';
import { resolveAudience } from '../messaging/audience.js';
import { MESSAGE_TEMPLATES } from '../messaging/templates.js';
import type { Repositories } from '../repositories/types.js';
import { asyncHandler, requirePermission } from './middleware.js';

const audienceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ALL_STUDENTS') }),
  z.object({ kind: z.literal('PROGRAMME'), programme: z.string().regex(/^[A-Z]{2,6}$/) }),
  z.object({ kind: z.literal('YEAR_GROUP'), yearGroup: z.number().int().min(2000).max(2100) }),
  z.object({ kind: z.literal('STANDING'), standing: z.enum(['RED', 'YELLOW', 'GREEN']) }),
  z.object({ kind: z.literal('STUDENTS'), studentIds: z.array(z.string().regex(/^[\w-]{1,64}$/)).min(1).max(500) })
]);
const messageSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(5000),
  priority: z.enum(['NORMAL', 'HIGH']).default('NORMAL'),
  audience: audienceSchema,
  /** Optional future delivery time (ISO 8601); omitted means now. */
  sendAt: z.string().datetime({ offset: true }).optional()
});
const MAX_SCHEDULE_DAYS = 180;
const messageIdSchema = z.string().regex(/^[\w-]{1,64}$/);

/** US-11: admins compose and target messages, then follow their reach. */
export function adminMessageRoutes(repositories: Repositories, now: () => Date): Router {
  const router = Router();

  router.get('/templates', requirePermission('message:send'), (_req, res) => {
    res.json({ templates: MESSAGE_TEMPLATES });
  });

  router.post('/preview', requirePermission('message:send'), asyncHandler(async (req, res) => {
    const parsed = audienceSchema.safeParse(req.body?.audience);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_INPUT' });
      return;
    }
    const { recipients, unknownIds } = await resolveAudience(parsed.data, repositories, now());
    res.json({ recipientCount: recipients.length, unknownIds });
  }));

  router.post('/', requirePermission('message:send'), asyncHandler(async (req, res) => {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success || !req.auth) {
      res.status(400).json({ error: 'INVALID_INPUT' });
      return;
    }
    const { sendAt, ...content } = parsed.data;
    const at = now();
    const scheduledFor = sendAt ? new Date(sendAt) : undefined;
    if (scheduledFor && (scheduledFor.getTime() <= at.getTime() + 60_000 || scheduledFor.getTime() > at.getTime() + MAX_SCHEDULE_DAYS * 86_400_000)) {
      res.status(400).json({ error: 'INVALID_SCHEDULE', message: `Schedule at least a minute ahead and at most ${MAX_SCHEDULE_DAYS} days ahead.` });
      return;
    }
    // Recipients are fixed when the message is created, so a scheduled standing message reaches today's students in that band.
    const { recipients, unknownIds } = await resolveAudience(content.audience, repositories, at);
    if (recipients.length === 0) {
      res.status(422).json({ error: 'NO_RECIPIENTS', unknownIds });
      return;
    }
    const message = await repositories.messages.send({ ...content, senderId: req.auth.sub, sentAt: scheduledFor ?? at }, recipients);
    await repositories.auditLog.append({
      action: 'ADMIN_MESSAGE_SENT', actorId: req.auth.sub, actorRole: req.auth.role, subject: message.id,
      metadata: { audience: content.audience.kind, recipients: recipients.length, priority: content.priority, ...(scheduledFor ? { scheduledFor: scheduledFor.toISOString() } : {}) },
      requestId: req.requestId, ip: req.ip, at
    });
    res.status(201).json({ message, unknownIds });
  }));

  router.get('/', requirePermission('message:send'), asyncHandler(async (_req, res) => {
    const at = now();
    const messages = await repositories.messages.listSent(100);
    res.json({ messages: messages.map(message => ({ ...message, scheduled: message.sentAt > at })) });
  }));

  router.delete('/:messageId', requirePermission('message:send'), asyncHandler(async (req, res) => {
    const parsed = messageIdSchema.safeParse(req.params.messageId);
    if (!parsed.success || !req.auth || !(await repositories.messages.cancelScheduled(parsed.data, now()))) {
      res.status(409).json({ error: 'NOT_CANCELLABLE', message: 'Only a scheduled message that has not been delivered yet can be cancelled.' });
      return;
    }
    await repositories.auditLog.append({ action: 'ADMIN_MESSAGE_CANCELLED', actorId: req.auth.sub, actorRole: req.auth.role, subject: parsed.data, requestId: req.requestId, ip: req.ip, at: now() });
    res.status(204).end();
  }));

  return router;
}

/** US-12: each student's own inbox; the student ID always comes from the access token. */
export function studentMessageRoutes(repositories: Repositories, now: () => Date): Router {
  const router = Router();
  const own = (studentId: string | undefined) => studentId ?? '';

  router.get('/', requirePermission('message:read:own'), asyncHandler(async (req, res) => {
    const studentId = own(req.auth?.studentId);
    const [messages, unread] = await Promise.all([repositories.messages.inbox(studentId, 100, now()), repositories.messages.unreadCount(studentId, now())]);
    res.json({ messages, unread });
  }));

  router.get('/unread-count', requirePermission('message:read:own'), asyncHandler(async (req, res) => {
    res.json({ unread: await repositories.messages.unreadCount(own(req.auth?.studentId), now()) });
  }));

  router.post('/read-all', requirePermission('message:read:own'), asyncHandler(async (req, res) => {
    res.json({ marked: await repositories.messages.markRead(own(req.auth?.studentId), now()) });
  }));

  router.post('/:messageId/read', requirePermission('message:read:own'), asyncHandler(async (req, res) => {
    const parsed = messageIdSchema.safeParse(req.params.messageId);
    if (!parsed.success) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    res.json({ marked: await repositories.messages.markRead(own(req.auth?.studentId), now(), parsed.data) });
  }));

  return router;
}
