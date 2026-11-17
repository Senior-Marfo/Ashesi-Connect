import type { EligibilityView } from '../eligibility/assess.js';
import { passesCourse, type PassMarks } from '../domain/eligibility/pass-marks.js';
import type { CourseRecord } from '../repositories/types.js';

const GRADES = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E'] as const;
type Grade = (typeof GRADES)[number];
type StandingKey = 'RED' | 'YELLOW' | 'GREEN' | 'UNDETERMINED';

/** Why an assessed student has not met every requirement; a student can have several. */
export const NON_COMPLETION_REASONS = ['FAILED_COURSE', 'INCOMPLETE_COURSE', 'REQUIRED_COURSE_NOT_TAKEN', 'CAPSTONE_OUTSTANDING', 'ELECTIVES_SHORT', 'CREDIT_SHORTFALL', 'STILL_IN_PROGRESS'] as const;
export type NonCompletionReason = (typeof NON_COMPLETION_REASONS)[number];

export interface ReportStudent {
  assessment: EligibilityView;
  courses: CourseRecord[];
  /** The year group's graduation term has ended. */
  graduated: boolean;
}

export type StandingCounts = Record<StandingKey, number>;

export interface CohortOutcome {
  yearGroup: number;
  students: number;
  assessed: number;
  requirementsMet: number;
  /** Share of assessed students who met every requirement (a graduation-rate proxy); null when none assessed. */
  completionRate: number | null;
  reasons: Record<NonCompletionReason, number>;
}

export interface CohortProgress { yearGroup: number; students: number; assessed: number; averagePercentComplete: number | null; standings: StandingCounts }

export interface ProgrammeComparison {
  programme: string;
  students: number;
  averagePassedCredits: number;
  /** Among students in graduated year groups. */
  completionRate: number | null;
  standings: StandingCounts;
}

export interface CourseOutcome {
  courseCode: string;
  students: number;
  attempts: number;
  /** Share of students whose first attempt passed (provisional D+ pass mark); null when none graded. */
  firstAttemptPassRate: number | null;
  /** Students whose latest attempt is still below the pass mark. */
  unresolvedFailures: number;
  /** Students who took the course more than once. */
  retakes: number;
  grades: Record<Grade, number>;
}

/** Bands of credits still outstanding after courses in progress, for students still studying. */
export const CREDIT_BANDS = ['0', '0.5–4', '4.5–8', '8.5–16', 'Over 16'] as const;
export type CreditBand = (typeof CREDIT_BANDS)[number];

/** Where each assessed, current year group is heading, judged by advisory standing. */
export interface GraduationProjection {
  yearGroup: number;
  /** The year group's planned graduation term. */
  term: string;
  /** Green: on track for the planned term. */
  onPlan: number;
  /** Yellow: can still finish on time but needs attention. */
  atRisk: number;
  /** Red: not enough terms left at the maximum load, so likely to finish later. */
  likelyLater: number;
}

export interface Reports {
  totals: { students: number; assessed: number; graduatedCohorts: number[] };
  creditsRemaining: Record<CreditBand, number>;
  projections: GraduationProjection[];
  standings: StandingCounts;
  cohortOutcomes: CohortOutcome[];
  cohortProgress: CohortProgress[];
  programmes: ProgrammeComparison[];
  courses: CourseOutcome[];
}

const round = (value: number, places = 1) => Math.round(value * 10 ** places) / 10 ** places;
const rate = (part: number, whole: number) => (whole > 0 ? round((100 * part) / whole) : null);
const emptyStandings = (): StandingCounts => ({ RED: 0, YELLOW: 0, GREEN: 0, UNDETERMINED: 0 });
const standingOf = (student: ReportStudent): StandingKey => student.assessment.standing?.level ?? 'UNDETERMINED';
const isAssessed = (student: ReportStudent) => student.assessment.audit !== null;
const isMet = (student: ReportStudent) => student.assessment.status === 'REQUIREMENTS_MET';

function nonCompletionReasons(student: ReportStudent): Set<NonCompletionReason> {
  const reasons = new Set<NonCompletionReason>();
  for (const item of student.assessment.audit?.remainingRequirements ?? []) {
    if (item.reason === 'FAILED') reasons.add('FAILED_COURSE');
    else if (item.reason === 'INCOMPLETE') reasons.add('INCOMPLETE_COURSE');
    else if (item.reason === 'NOT_TAKEN') reasons.add(item.category === 'Capstone' ? 'CAPSTONE_OUTSTANDING' : 'REQUIRED_COURSE_NOT_TAKEN');
    else if (item.reason === 'ELECTIVE_SLOT_OPEN' || item.reason === 'AFRICAN_STUDIES_MISSING') reasons.add('ELECTIVES_SHORT');
    else if (item.reason === 'CREDIT_SHORTFALL') reasons.add('CREDIT_SHORTFALL');
    else if (item.reason === 'IN_PROGRESS') reasons.add('STILL_IN_PROGRESS');
  }
  if (student.assessment.audit?.remainingRequirements.some(item => item.reason === 'FAILED' && item.category === 'Capstone')) reasons.add('CAPSTONE_OUTSTANDING');
  return reasons;
}

function creditBand(credits: number): CreditBand {
  if (credits <= 0) return '0';
  if (credits <= 4) return '0.5–4';
  if (credits <= 8) return '4.5–8';
  return credits <= 16 ? '8.5–16' : 'Over 16';
}

function groupBy<K>(students: ReportStudent[], key: (student: ReportStudent) => K): Map<K, ReportStudent[]> {
  const groups = new Map<K, ReportStudent[]>();
  for (const student of students) groups.set(key(student), [...(groups.get(key(student)) ?? []), student]);
  return groups;
}

const passedCredits = (courses: CourseRecord[], marks: PassMarks) => courses.reduce((sum, course) => {
  const latest = course.attempts.at(-1);
  return sum + (latest?.status === 'COMPLETED' && passesCourse(course.courseCode, latest.grade, marks) ? latest.credits : 0);
}, 0);

function courseOutcomes(students: ReportStudent[], marks: PassMarks): CourseOutcome[] {
  const byCourse = new Map<string, CourseRecord['attempts'][]>();
  for (const student of students) for (const course of student.courses) byCourse.set(course.courseCode, [...(byCourse.get(course.courseCode) ?? []), course.attempts]);
  return [...byCourse].map(([courseCode, records]) => {
    const grades = Object.fromEntries(GRADES.map(grade => [grade, 0])) as Record<Grade, number>;
    let firstGraded = 0;
    let firstPassed = 0;
    for (const attempts of records) {
      for (const attempt of attempts) if (attempt.grade && attempt.grade in grades) grades[attempt.grade as Grade] += 1;
      const first = attempts[0];
      if (first?.status === 'COMPLETED' && first.grade) {
        firstGraded += 1;
        if (passesCourse(courseCode, first.grade, marks)) firstPassed += 1;
      }
    }
    return {
      courseCode,
      students: records.length,
      attempts: records.reduce((sum, attempts) => sum + attempts.length, 0),
      firstAttemptPassRate: rate(firstPassed, firstGraded),
      unresolvedFailures: records.filter(attempts => {
        const latest = attempts.at(-1);
        return latest?.status === 'COMPLETED' && latest.grade !== undefined && !passesCourse(courseCode, latest.grade, marks);
      }).length,
      retakes: records.filter(attempts => attempts.length > 1).length,
      grades
    };
  }).sort((a, b) => a.courseCode.localeCompare(b.courseCode));
}

/**
 * Aggregate reports for the Registry. Outcomes come from the same advisory assessment
 * as the student screens; course statistics use the pass-mark catalogue (D+ where unset).
 */
export function buildReports(students: ReportStudent[], marks: PassMarks): Reports {
  const standings = emptyStandings();
  for (const student of students) standings[standingOf(student)] += 1;

  const byYear = [...groupBy(students, student => student.assessment.student.yearGroup)].sort(([a], [b]) => a - b);
  const cohortOutcomes = byYear.filter(([, group]) => group.every(student => student.graduated)).map(([yearGroup, group]) => {
    const assessed = group.filter(isAssessed);
    const reasons = Object.fromEntries(NON_COMPLETION_REASONS.map(reason => [reason, 0])) as Record<NonCompletionReason, number>;
    for (const student of assessed.filter(student => !isMet(student))) for (const reason of nonCompletionReasons(student)) reasons[reason] += 1;
    const requirementsMet = assessed.filter(isMet).length;
    return { yearGroup, students: group.length, assessed: assessed.length, requirementsMet, completionRate: rate(requirementsMet, assessed.length), reasons };
  });
  const cohortProgress = byYear.filter(([, group]) => !group.every(student => student.graduated)).map(([yearGroup, group]) => {
    const assessed = group.filter(isAssessed);
    const counts = emptyStandings();
    for (const student of group) counts[standingOf(student)] += 1;
    const average = assessed.length ? round(assessed.reduce((sum, student) => sum + (student.assessment.audit?.percentComplete ?? 0), 0) / assessed.length) : null;
    return { yearGroup, students: group.length, assessed: assessed.length, averagePercentComplete: average, standings: counts };
  });
  const programmes = [...groupBy(students, student => student.assessment.student.programme)].sort(([a], [b]) => a.localeCompare(b)).map(([programme, group]) => {
    const counts = emptyStandings();
    for (const student of group) counts[standingOf(student)] += 1;
    const graduatedAssessed = group.filter(student => student.graduated && isAssessed(student));
    return {
      programme,
      students: group.length,
      averagePassedCredits: round(group.reduce((sum, student) => sum + passedCredits(student.courses, marks), 0) / group.length),
      completionRate: rate(graduatedAssessed.filter(isMet).length, graduatedAssessed.length),
      standings: counts
    };
  });

  const current = students.filter(student => !student.graduated && student.assessment.standing);
  const creditsRemaining = Object.fromEntries(CREDIT_BANDS.map(band => [band, 0])) as Record<CreditBand, number>;
  for (const student of current) creditsRemaining[creditBand(student.assessment.standing!.creditsOutstanding)] += 1;
  const projections = [...groupBy(current, student => student.assessment.student.yearGroup)].sort(([a], [b]) => a - b).map(([yearGroup, group]) => ({
    yearGroup,
    term: group[0].assessment.expectedGraduation,
    onPlan: group.filter(student => standingOf(student) === 'GREEN').length,
    atRisk: group.filter(student => standingOf(student) === 'YELLOW').length,
    likelyLater: group.filter(student => standingOf(student) === 'RED').length
  }));

  return {
    totals: { students: students.length, assessed: students.filter(isAssessed).length, graduatedCohorts: cohortOutcomes.map(cohort => cohort.yearGroup) },
    creditsRemaining,
    projections,
    standings,
    cohortOutcomes,
    cohortProgress,
    programmes,
    courses: courseOutcomes(students, marks)
  };
}
