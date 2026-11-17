import express, { Router } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { planImport, rollbackImport } from '../imports/service.js';
import type { Repositories } from '../repositories/types.js';
import { asyncHandler, requirePermission } from './middleware.js';

export const IMPORT_BODY_LIMIT = '5mb';

const uploadSchema = z.object({
  kind: z.enum(['STUDENTS', 'COURSES']),
  filename: z.string().trim().min(1).max(200).regex(/\.csv$/i, 'Only .csv files are accepted'),
  content: z.string().min(1).max(4_000_000)
});

export function importRoutes(config: AppConfig, repositories: Repositories, now: () => Date): Router {
  const router = Router();
  router.use(express.json({ limit: IMPORT_BODY_LIMIT }));

  const parse = (body: unknown) => uploadSchema.safeParse(body);

  router.get('/', requirePermission('records:import'), asyncHandler(async (_req, res) => {
    const batches = await repositories.imports.list(50);
    const latest = await repositories.imports.latestApplied();
    res.json({ batches: batches.map(batch => ({ ...batch, canUndo: batch.id === latest?.id })) });
  }));

  router.post('/preview', requirePermission('records:import'), asyncHandler(async (req, res) => {
    const parsed = parse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_INPUT', message: parsed.error.issues[0]?.message });
      return;
    }
    const plan = await planImport(parsed.data.kind, parsed.data.content, repositories, config.studentIdPattern);
    res.json(plan.preview);
  }));

  router.post('/', requirePermission('records:import'), asyncHandler(async (req, res) => {
    const parsed = parse(req.body);
    if (!parsed.success || !req.auth) {
      res.status(400).json({ error: 'INVALID_INPUT', message: parsed.success ? undefined : parsed.error.issues[0]?.message });
      return;
    }
    const plan = await planImport(parsed.data.kind, parsed.data.content, repositories, config.studentIdPattern);
    if (plan.preview.errorCount > 0) {
      res.status(422).json({ error: 'IMPORT_HAS_ERRORS', preview: plan.preview });
      return;
    }
    const at = now();
    const batch = await plan.apply(req.auth.sub, parsed.data.filename, at);
    await repositories.auditLog.append({
      action: 'ADMIN_IMPORT_APPLIED', actorId: req.auth.sub, actorRole: req.auth.role, subject: batch.id,
      metadata: { kind: batch.kind, filename: batch.filename, rows: batch.rows, created: batch.created, updated: batch.updated },
      requestId: req.requestId, ip: req.ip, at
    });
    const { undo: _undo, ...summary } = batch;
    res.status(201).json({ batch: summary });
  }));

  router.post('/:batchId/rollback', requirePermission('records:import'), asyncHandler(async (req, res) => {
    const at = now();
    const result = await rollbackImport(String(req.params.batchId), repositories, at);
    if (result === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    if (result === 'NOT_LATEST') {
      res.status(409).json({ error: 'NOT_LATEST_IMPORT', message: 'Undo newer imports first.' });
      return;
    }
    await repositories.auditLog.append({
      action: 'ADMIN_IMPORT_ROLLED_BACK', actorId: req.auth?.sub, actorRole: req.auth?.role, subject: String(req.params.batchId),
      requestId: req.requestId, ip: req.ip, at
    });
    res.json({ status: 'ROLLED_BACK' });
  }));

  return router;
}
