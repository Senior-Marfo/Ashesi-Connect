import type { StandingLevel } from '../domain/eligibility/standing.js';
import type { Repositories, StudentSummary } from '../repositories/types.js';
import { assessEligibility, type AppliedCurriculum } from './assess.js';
import { curriculumFor } from './curriculum.js';

/** Advisory standing for each student that has an applicable curriculum; others are left out. */
export async function standingsFor(students: StudentSummary[], repositories: Repositories, today: Date): Promise<Map<string, StandingLevel>> {
  const courses = await repositories.students.coursesFor(students.map(student => student.studentId));
  const curricula = new Map<string, Promise<AppliedCurriculum | undefined>>();
  const standings = new Map<string, StandingLevel>();
  for (const student of students) {
    const key = `${student.synthetic ? 'synthetic' : 'reviewed'}|${student.programme}|${student.track}|${student.yearGroup}`;
    if (!curricula.has(key)) curricula.set(key, curriculumFor(student, repositories));
    const curriculum = await curricula.get(key);
    const { standing } = assessEligibility(student, courses.get(student.studentId) ?? [], curriculum, today);
    if (standing) standings.set(student.studentId, standing.level);
  }
  return standings;
}
