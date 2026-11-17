import { Router } from 'express';
import { assessEligibility } from '../eligibility/assess.js';
import { curriculumFor } from '../eligibility/curriculum.js';
import type { Repositories } from '../repositories/types.js';
import { asyncHandler, requirePermission } from './middleware.js';

export function studentRoutes(repositories: Repositories, now: () => Date): Router {
  const router = Router();

  // The student ID comes only from the verified token, never from the request, so one student cannot read another's record.
  router.get('/me', requirePermission('student:read:own'), asyncHandler(async (req, res) => {
    const studentId = req.auth?.studentId;
    const student = studentId ? await repositories.students.findById(studentId) : undefined;
    if (!studentId || !student) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    res.json({ student, courses: await repositories.students.listCourses(studentId) });
  }));

  router.get('/me/eligibility', requirePermission('student:read:own'), asyncHandler(async (req, res) => {
    const studentId = req.auth?.studentId;
    const student = studentId ? await repositories.students.findById(studentId) : undefined;
    if (!studentId || !student) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    const [courses, curriculum] = await Promise.all([repositories.students.listCourses(studentId), curriculumFor(student, repositories)]);
    res.json(assessEligibility(student, courses, curriculum, now()));
  }));

  return router;
}
