import type { StandingLevel } from '../domain/eligibility/standing.js';
import type { CourseRecord, Repositories, StudentSummary } from '../repositories/types.js';
import { assessEligibility, type AppliedCurriculum, type EligibilityView } from './assess.js';
import { curriculumFor, loadPassMarks } from './curriculum.js';

export interface AssessedStudent { assessment: EligibilityView; courses: CourseRecord[] }

/** Assesses many students at once, loading each distinct curriculum only once. */
export async function assessAll(students: StudentSummary[], repositories: Repositories, today: Date): Promise<Map<string, AssessedStudent>> {
  const [courses, settings, passMarks] = await Promise.all([repositories.students.coursesFor(students.map(student => student.studentId)), repositories.settings.get(), loadPassMarks(repositories)]);
  const curricula = new Map<string, Promise<AppliedCurriculum | undefined>>();
  const assessed = new Map<string, AssessedStudent>();
  for (const student of students) {
    const key = `${student.synthetic ? 'synthetic' : 'reviewed'}|${student.programme}|${student.track}|${student.yearGroup}`;
    if (!curricula.has(key)) curricula.set(key, curriculumFor(student, repositories, passMarks));
    const records = courses.get(student.studentId) ?? [];
    assessed.set(student.studentId, { assessment: assessEligibility(student, records, await curricula.get(key), today, settings.standing), courses: records });
  }
  return assessed;
}

/** Advisory standing for each student that has an applicable curriculum; others are left out. */
export async function standingsFor(students: StudentSummary[], repositories: Repositories, today: Date): Promise<Map<string, StandingLevel>> {
  const standings = new Map<string, StandingLevel>();
  for (const [studentId, { assessment }] of await assessAll(students, repositories, today)) {
    if (assessment.standing) standings.set(studentId, assessment.standing.level);
  }
  return standings;
}
