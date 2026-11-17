import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { graduationTermEnded } from '../domain/eligibility/terms.js';
import { loadPassMarks } from '../eligibility/curriculum.js';
import { assessAll } from '../eligibility/standings.js';
import { toCsv } from '../reports/csv.js';
import { NON_COMPLETION_REASONS, buildReports, type Reports } from '../reports/reports.js';
import type { Repositories } from '../repositories/types.js';
import { asyncHandler, requirePermission } from './middleware.js';

const filterSchema = z.object({
  programme: z.string().regex(/^[A-Z]{2,6}$/).optional(),
  yearGroup: z.coerce.number().int().min(2000).max(2100).optional()
});
const SECTIONS = ['cohorts', 'programmes', 'courses'] as const;
const GRADE_COLUMNS = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E'] as const;

function sectionCsv(section: (typeof SECTIONS)[number], reports: Reports): string {
  if (section === 'cohorts') {
    return toCsv(
      ['Year group', 'Students', 'Assessed', 'Requirements met', 'Completion rate %', ...NON_COMPLETION_REASONS],
      reports.cohortOutcomes.map(c => [c.yearGroup, c.students, c.assessed, c.requirementsMet, c.completionRate, ...NON_COMPLETION_REASONS.map(reason => c.reasons[reason])])
    );
  }
  if (section === 'programmes') {
    return toCsv(
      ['Programme', 'Students', 'Average passed credits (provisional D+)', 'Completion rate % (graduated cohorts)', 'Critical', 'At risk', 'On track', 'Not determined'],
      reports.programmes.map(p => [p.programme, p.students, p.averagePassedCredits, p.completionRate, p.standings.RED, p.standings.YELLOW, p.standings.GREEN, p.standings.UNDETERMINED])
    );
  }
  return toCsv(
    ['Course', 'Students', 'Attempts', 'First-attempt pass rate % (provisional D+)', 'Failed, not retaken', 'Retaken', ...GRADE_COLUMNS],
    reports.courses.map(c => [c.courseCode, c.students, c.attempts, c.firstAttemptPassRate, c.unresolvedFailures, c.retakes, ...GRADE_COLUMNS.map(grade => c.grades[grade])])
  );
}

export function reportRoutes(repositories: Repositories, now: () => Date): Router {
  const router = Router();

  const load = async (req: Request, res: Response) => {
    const parsed = filterSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_INPUT' });
      return undefined;
    }
    const today = now();
    const students = await repositories.students.list(parsed.data);
    const [assessed, passMarks] = await Promise.all([assessAll(students, repositories, today), loadPassMarks(repositories)]);
    const reports = buildReports(students.map(student => ({
      ...assessed.get(student.studentId)!,
      graduated: graduationTermEnded(student.yearGroup, today)
    })), passMarks);
    return { filters: parsed.data, reports };
  };

  /** Reach of every delivered message; scheduled ones are left out until they go out. Not narrowed by the filters. */
  const messagingReach = async () => {
    const at = now();
    const delivered = (await repositories.messages.listSent(1000)).filter(message => message.sentAt <= at);
    const recipients = delivered.reduce((sum, message) => sum + message.recipientCount, 0);
    const read = delivered.reduce((sum, message) => sum + message.readCount, 0);
    return { messages: delivered.length, recipients, read, readRate: recipients > 0 ? Math.round((1000 * read) / recipients) / 10 : null };
  };

  const audit = (req: Request, metadata: Record<string, string | number>) => repositories.auditLog.append({
    action: 'ADMIN_REPORTS_VIEWED', actorId: req.auth?.sub, actorRole: req.auth?.role, metadata, requestId: req.requestId, ip: req.ip, at: new Date()
  });

  router.get('/', requirePermission('report:read'), asyncHandler(async (req, res) => {
    const result = await load(req, res);
    if (!result) return;
    await audit(req, { ...result.filters });
    res.setHeader('cache-control', 'no-store');
    res.json({ generatedAt: now().toISOString(), filters: result.filters, ...result.reports, messaging: await messagingReach() });
  }));

  router.get('/:section.csv', requirePermission('report:read'), asyncHandler(async (req, res) => {
    const section = SECTIONS.find(name => name === req.params.section);
    if (!section) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    const result = await load(req, res);
    if (!result) return;
    await audit(req, { ...result.filters, export: section });
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="report-${section}.csv"`);
    res.setHeader('cache-control', 'no-store');
    res.send(sectionCsv(section, result.reports));
  }));

  return router;
}
