import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../http/middleware.js';
import { CurriculumRecord } from '../models/curriculum.js';
import { Student, Enrollment } from '../models.js';
import { mapEnrollmentTranscript, type EnrollmentRecord } from '../domain/eligibility/transcript-mapping.js';
import { previewAcademicProgress } from '../domain/eligibility/academic-preview.js';
import type { ProgrammeRules } from '../domain/eligibility/programme-audit.js';
import { selectCohortCurriculum, type CohortCurriculum } from '../domain/eligibility/cohort-selection.js';
import { previewGpa } from '../domain/eligibility/gpa-preview.js';
import { planCurriculumReview } from '../domain/eligibility/curriculum-review.js';
import { isCurriculumReviewEnabled } from '../domain/eligibility/review-feature-gate.js';
import { isAllowedCurriculumReviewer } from '../domain/eligibility/reviewer-allowlist.js';
import type { CurriculumVersion } from '../domain/eligibility/curriculum-version.js';
import type { Repositories } from '../repositories/types.js';

/**
 * Mounted under /api/v1/admin and /api/v1/students behind authentication and the
 * forced-password-change gate (see http/app.ts); each route adds its permission.
 */
export const curriculumStudentRouter = Router();

const detailQuerySchema = z.object({
 programme: z.string().trim().min(1).max(40),
 track: z.string().trim().min(1).max(100),
 version: z.string().trim().min(1).max(100)
});
const reviewRequestSchema = z.object({
 programme: z.string().trim().min(1).max(40),
 track: z.string().trim().min(1).max(100),
 version: z.string().trim().min(1).max(100),
 evidenceReference: z.string().trim().min(1).max(500)
}).strict();




/** Student-scoped, read-only availability; never claims a graduation decision. */
curriculumStudentRouter.get('/me/curriculum', requirePermission('student:read:own'), async (req, res) => {
 if (req.auth?.role !== 'STUDENT' || !req.auth.studentId) {
  res.status(403).json({ error: 'FORBIDDEN' }); return;
 }
 try {
  const student = await Student.findOne({ studentId: req.auth.studentId })
   .select('programme track yearGroup -_id').lean();
  if (!student) { res.status(404).json({ error: 'STUDENT_NOT_FOUND' }); return; }
  const curricula = await CurriculumRecord.find({
   programme: student.programme, track: student.track ?? 'standard', status: 'REVIEWED',
   validationIssues: { $size: 0 }
  }).select('programme track version status sources validationIssues updatedAt -_id').limit(200).lean();
  const selection = selectCohortCurriculum(student.yearGroup, curricula.map(c => ({
   version: String(c.version),
   status: c.status === 'REVIEWED' ? 'REVIEWED' as const : 'DRAFT' as const,
   validationIssues: Array.isArray(c.validationIssues) ? c.validationIssues.map(String) : ['INVALID_VALIDATION_ISSUES'],
   sources: Array.isArray(c.sources) ? c.sources.map((s: { effectiveYear?: unknown }) => ({
    effectiveYear: typeof s.effectiveYear === 'number' ? s.effectiveYear : Number.NaN
   })) : []
  })));
  res.json({
   programme: student.programme, track: student.track ?? 'standard', yearGroup: student.yearGroup,
   curricula: curricula.map(c => ({ programme:c.programme,track:c.track,version:c.version,status:c.status,updatedAt:c.updatedAt })),
   selectedVersion: selection.selectedVersion, selectionIssue: selection.issue,
   assessmentStatus: 'NOT_YET_CALCULATED', officialCertification: false
  });
 } catch { res.status(503).json({ error: 'CURRICULUM_UNAVAILABLE' }); }
});

/** Read-only student transcript readiness; does not infer GPA or issue graduation decisions. */
curriculumStudentRouter.get('/me/audit-readiness', requirePermission('student:read:own'), async (req, res) => {
 if (req.auth?.role !== 'STUDENT' || !req.auth.studentId) {
  res.status(403).json({ error: 'FORBIDDEN' }); return;
 }
 try {
  const student = await Student.findOne({ studentId: req.auth.studentId })
   .select('programme track yearGroup -_id').lean();
  if (!student) { res.status(404).json({ error: 'STUDENT_NOT_FOUND' }); return; }
  const records = await Enrollment.find({ studentId: req.auth.studentId })
   .select('courseCode attempts -_id').lean();
  const mapping = mapEnrollmentTranscript(records as EnrollmentRecord[]);
  const curricula = await CurriculumRecord.find({
   programme: student.programme, track: student.track ?? 'standard', status: 'REVIEWED',
   validationIssues: { $size: 0 }
  }).select('version status validationIssues sources -_id').limit(200).lean();
  const selection = selectCohortCurriculum(student.yearGroup, curricula.map(c => ({
   version: String(c.version),
   status: c.status === 'REVIEWED' ? 'REVIEWED' as const : 'DRAFT' as const,
   validationIssues: Array.isArray(c.validationIssues) ? c.validationIssues.map(String) : ['INVALID_VALIDATION_ISSUES'],
   sources: Array.isArray(c.sources) ? c.sources.map((s: { effectiveYear?: unknown }) => ({
    effectiveYear: typeof s.effectiveYear === 'number' ? s.effectiveYear : Number.NaN
   })) : []
  })));
  const issues = [...mapping.issues];
  if (selection.issue) issues.push(selection.issue);
  if (!mapping.entries.length) issues.push('NO_USABLE_TRANSCRIPT_ENTRIES');
  res.json({
   programme: student.programme, track: student.track ?? 'standard',
   transcriptEntries: mapping.entries.length,
   curriculumVersion: selection.selectedVersion,
   status: 'INSUFFICIENT_DATA', issues,
   nextStep: 'CURRICULUM_AND_TRANSCRIPT_RECONCILIATION',
   officialCertification: false
  });
 } catch { res.status(503).json({ error: 'AUDIT_READINESS_UNAVAILABLE' }); }
});

/**
 * Provisional course-progress preview. The selected curriculum must be reviewed,
 * issue-free, and student-scoped. No official graduation certification is issued.
 */
curriculumStudentRouter.get('/me/academic-preview', requirePermission('student:read:own'), async (req, res) => {
 if (req.auth?.role !== 'STUDENT' || !req.auth.studentId) {
  res.status(403).json({ error: 'FORBIDDEN' }); return;
 }
 try {
  const student = await Student.findOne({ studentId: req.auth.studentId })
   .select('programme track yearGroup -_id').lean();
  if (!student) { res.status(404).json({ error: 'STUDENT_NOT_FOUND' }); return; }
  const track = student.track ?? 'standard';
  const [records, curricula] = await Promise.all([
   Enrollment.find({ studentId: req.auth.studentId }).select('courseCode attempts -_id').lean(),
   CurriculumRecord.find({
    programme: student.programme, track, status: 'REVIEWED',
    validationIssues: { $size: 0 }
   }).select('version rules status validationIssues sources -_id').limit(200).lean()
  ]);
  const cohortCandidates: CohortCurriculum[] = curricula.map(c => ({
   version: String(c.version),
   status: c.status === 'REVIEWED' ? 'REVIEWED' : c.status === 'SUPERSEDED' ? 'SUPERSEDED' : 'DRAFT',
   validationIssues: Array.isArray(c.validationIssues) ? c.validationIssues.map(String) : ['INVALID_VALIDATION_ISSUES'],
   sources: Array.isArray(c.sources) ? c.sources.map((s: { effectiveYear?: unknown }) => ({
    effectiveYear: typeof s.effectiveYear === 'number' ? s.effectiveYear : Number.NaN
   })) : []
  }));
  const selection = selectCohortCurriculum(student.yearGroup, cohortCandidates);
  const selected = selection.selectedVersion
   ? curricula.find(c => c.version === selection.selectedVersion)
   : undefined;
  const enrollmentRecords = records as EnrollmentRecord[];
  const preview = previewAcademicProgress(enrollmentRecords, selected?.rules as ProgrammeRules | undefined ?? null);
  const transcript = mapEnrollmentTranscript(enrollmentRecords);
  const gpa = transcript.issues.length
   ? { gpa: null, gradedCredits: 0, issues: transcript.issues }
   : previewGpa(transcript.entries);
  const issues = [...preview.issues];
  if (selection.issue) issues.push(selection.issue);
  res.json({
   programme: student.programme, track, yearGroup: student.yearGroup,
   curriculumVersion: selected?.version ?? null,
   exploratoryGpa: gpa,
   ...preview,
   status: issues.length ? 'INSUFFICIENT_DATA' : preview.status,
   issues,
   officialCertification: false
  });
 } catch { res.status(503).json({ error: 'ACADEMIC_PREVIEW_UNAVAILABLE' }); }
});

/** Admin curriculum routes. Reviews are audit-logged; everything else is read-only. */
export function curriculumAdminRoutes(repositories: Repositories, now: () => Date): Router {
 const router = Router();
 /**
  * CURRICULUM_REVIEWER_IDS may list internal account IDs or staff IDs (STF-0001). A staff ID is
  * matched against the stored account, never the request, and only for admin accounts. Fails closed.
  */
 const isReviewer = async (userId: string | undefined): Promise<boolean> => {
  const configured = process.env.CURRICULUM_REVIEWER_IDS;
  if (!userId) return false;
  if (isAllowedCurriculumReviewer(userId, configured)) return true;
  const account = await repositories.users.findById(userId).catch(() => undefined);
  return account?.role === 'ADMIN' && isAllowedCurriculumReviewer(account.identifier, configured);
 };

/**
 * Administrator review is deliberately non-certifying. Only a draft with
 * validated rules and recorded evidence may be promoted to REVIEWED.
 * Conditional update prevents two concurrent reviewers from overwriting one another.
 */
router.post('/curricula/review', requirePermission('curriculum:review'), async (req, res) => {
 // Fail closed until a deployment operator explicitly enables this workflow.
 // Enabling the flag is not itself proof of Registry reviewer authorization.
 if (!isCurriculumReviewEnabled(process.env.ENABLE_CURRICULUM_REVIEW)) {
  res.status(503).json({ error:'CURRICULUM_REVIEW_DISABLED' }); return;
 }
 const parsed = reviewRequestSchema.safeParse(req.body);
 if (!parsed.success) { res.status(400).json({ error:'INVALID_INPUT' }); return; }
 if (!req.auth?.sub) { res.status(401).json({ error:'UNAUTHORIZED' }); return; }
 if (!(await isReviewer(req.auth.sub))) {
  res.status(403).json({ error:'REVIEWER_NOT_AUTHORIZED' }); return;
 }
 try {
  const { programme, track, version, evidenceReference } = parsed.data;
  // programme + track + version is unique (models/curriculum.ts), so at most one record matches.
  const record = await repositories.curricula.findVersion(programme, track, version);
  if (!record) { res.status(404).json({ error:'CURRICULUM_NOT_FOUND' }); return; }
  const curriculum: CurriculumVersion = { version: record.version, status: record.status, rules: record.rules, sources: record.sources };
  const decision = planCurriculumReview(curriculum,{
   reviewerId:req.auth.sub,evidenceReference,reviewedAt:now()
  });
  if (record.validationIssues.length || !decision.accepted || !decision.review) {
   res.status(409).json({ error:'CURRICULUM_REVIEW_BLOCKED', issues:[...record.validationIssues,...decision.issues] }); return;
  }
  const updated = await repositories.curricula.markReviewed(programme, track, version, decision.review);
  if (!updated) { res.status(409).json({error:'CURRICULUM_REVIEW_CONFLICT'}); return; }
  await repositories.auditLog.append({
   action: 'ADMIN_CURRICULUM_REVIEWED', actorId: req.auth.sub, actorRole: req.auth.role, subject: `${programme}/${track}/${version}`,
   metadata: { evidenceReference }, requestId: req.requestId, ip: req.ip, at: now()
  });
  const { programme: p, track: t, version: v, status, review } = updated;
  res.json({ curriculum: { programme: p, track: t, version: v, status, review }, officialCertification:false });
 } catch { res.status(503).json({error:'CURRICULUM_REVIEW_UNAVAILABLE'}); }
});

/** Administrative catalogue metadata; no mutable rules or private student records. */
router.get('/curricula', requirePermission('curriculum:read'), async (_req, res) => {
  try {
   res.json({ curricula: await repositories.curricula.list() });
  } catch { res.status(503).json({ error: 'CURRICULUM_UNAVAILABLE' }); }
 });

 router.get('/curricula/review-access', requirePermission('curriculum:read'), async (req, res) => {
  res.json({ enabled: isCurriculumReviewEnabled(process.env.ENABLE_CURRICULUM_REVIEW), allowed: await isReviewer(req.auth?.sub) });
 });

 /** One version's full rules, so a reviewer can see exactly what they would approve. */
 router.get('/curricula/detail', requirePermission('curriculum:read'), async (req, res) => {
  const parsed = detailQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'INVALID_INPUT' }); return; }
  try {
   const curriculum = await repositories.curricula.findVersion(parsed.data.programme, parsed.data.track, parsed.data.version);
   if (!curriculum) { res.status(404).json({ error: 'CURRICULUM_NOT_FOUND' }); return; }
   const reviewer = curriculum.review ? await repositories.users.findById(curriculum.review.reviewerId) : undefined;
   res.json({ curriculum: { ...curriculum, review: curriculum.review && { ...curriculum.review, reviewerIdentifier: reviewer?.identifier } } });
  } catch { res.status(503).json({ error: 'CURRICULUM_UNAVAILABLE' }); }
 });

 return router;
}
