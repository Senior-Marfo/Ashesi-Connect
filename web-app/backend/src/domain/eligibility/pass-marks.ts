import type { Grade } from './engine.js';
import type { ProgrammeRules } from './programme-audit.js';

/** Pass marks the catalogue may set per course (master build prompt §3.4). */
export const PASS_MARK_GRADES = ['D+', 'C'] as const;
export type PassMarkGrade = (typeof PASS_MARK_GRADES)[number];

/** Provisional pass mark for any course without a confirmed one (assumptions log). */
export const DEFAULT_PASS_MARK: Grade = 'D+';

/** Course code → confirmed minimum passing grade. */
export type PassMarks = ReadonlyMap<string, PassMarkGrade>;

const GRADE_RANK: readonly string[] = ['E', 'D', 'D+', 'C', 'C+', 'B', 'B+', 'A', 'A+'];

export function meetsGrade(grade: string | undefined, minimum: string): boolean {
  return grade !== undefined && GRADE_RANK.includes(grade) && GRADE_RANK.indexOf(grade) >= GRADE_RANK.indexOf(minimum);
}

/** Whether a grade passes this course under the catalogue, falling back to the provisional D+. */
export function passesCourse(courseCode: string, grade: string | undefined, marks: PassMarks): boolean {
  return meetsGrade(grade, marks.get(courseCode) ?? DEFAULT_PASS_MARK);
}

/** Grades that pass, grouped by the courses they apply to; used to build database queries. */
export function passingGradesByCourse(marks: PassMarks): { overrides: Array<{ courseCodes: string[]; grades: string[] }>; fallback: string[] } {
  const passing = (minimum: string) => GRADE_RANK.filter(grade => meetsGrade(grade, minimum));
  const byGrade = new Map<string, string[]>();
  for (const [courseCode, grade] of marks) byGrade.set(grade, [...(byGrade.get(grade) ?? []), courseCode]);
  return { overrides: [...byGrade].map(([grade, courseCodes]) => ({ courseCodes, grades: passing(grade) })), fallback: passing(DEFAULT_PASS_MARK) };
}

/**
 * The catalogue is the Registry's latest word on a course, so its pass mark replaces the one in
 * the curriculum rules, for required courses and for courses inside elective pools alike.
 */
export function applyPassMarks(rules: ProgrammeRules, marks: PassMarks): ProgrammeRules {
  if (marks.size === 0) return rules;
  return {
    ...rules,
    requiredCourses: rules.requiredCourses.map(rule => ({ ...rule, minimumGrade: marks.get(rule.courseCode) ?? rule.minimumGrade })),
    electivePools: rules.electivePools.map(pool => {
      const courseMinimums = Object.fromEntries(pool.courseCodes.flatMap(code => {
        const mark = marks.get(code);
        return mark ? [[code, mark]] : [];
      })) as Record<string, Grade>;
      return Object.keys(courseMinimums).length ? { ...pool, courseMinimums: { ...pool.courseMinimums, ...courseMinimums } } : pool;
    })
  };
}
