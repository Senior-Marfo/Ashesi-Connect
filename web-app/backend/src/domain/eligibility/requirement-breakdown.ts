import type { Grade } from './engine.js';
import { electiveMinimum, type ProgrammeRules, type TranscriptEntry } from './programme-audit.js';

export type RequirementState = 'COMPLETED' | 'IN_PROGRESS' | 'FAILED' | 'INCOMPLETE' | 'NOT_STARTED';

export interface RequirementItem {
  code: string;
  credits: number;
  minimumGrade: Grade;
  state: RequirementState;
  /** The passing grade, or the latest grade when not yet passed. */
  grade?: Grade;
  attempts: number;
}

export interface RequirementGroup {
  category: string;
  kind: 'REQUIRED' | 'ELECTIVE';
  creditsRequired: number;
  creditsCompleted: number;
  creditsInProgress: number;
  items: RequirementItem[];
  /** Elective options not taken yet. */
  options: string[];
}

const GRADE_RANK: Grade[] = ['E', 'D', 'D+', 'C', 'C+', 'B', 'B+', 'A', 'A+'];
// Matches evaluateProgramme: electives without a stated minimum pass at D (handbook).
const passes = (grade: Grade | undefined, minimum: Grade) => grade !== undefined && GRADE_RANK.indexOf(grade) >= GRADE_RANK.indexOf(minimum);
const round = (value: number) => Math.round(value * 100) / 100;

function itemFor(code: string, credits: number, minimumGrade: Grade, transcript: TranscriptEntry[]): RequirementItem {
  const attempts = transcript.filter(entry => entry.courseCode === code).sort((a, b) => a.attempt - b.attempt);
  const passed = [...attempts].reverse().find(entry => passes(entry.grade, minimumGrade));
  const latest = attempts.at(-1);
  const base = { code, credits, minimumGrade, attempts: attempts.length };
  if (passed) return { ...base, state: 'COMPLETED', grade: passed.grade };
  if (!latest) return { ...base, state: 'NOT_STARTED' };
  if (latest.status === 'IN_PROGRESS') return { ...base, state: 'IN_PROGRESS' };
  if (latest.status === 'INCOMPLETE') return { ...base, state: 'INCOMPLETE' };
  return { ...base, state: 'FAILED', grade: latest.grade };
}

const sumCredits = (items: RequirementItem[], state: RequirementState) => round(items.filter(item => item.state === state).reduce((sum, item) => sum + item.credits, 0));

/** Every requirement of the programme with the student's state against it, grouped by category. */
export function requirementBreakdown(transcript: TranscriptEntry[], rules: ProgrammeRules): RequirementGroup[] {
  const groups = new Map<string, RequirementItem[]>();
  for (const rule of rules.requiredCourses) {
    const items = groups.get(rule.category) ?? [];
    items.push(itemFor(rule.courseCode, rule.credits, rule.minimumGrade, transcript));
    groups.set(rule.category, items);
  }
  const required: RequirementGroup[] = [...groups].map(([category, items]) => ({
    category, kind: 'REQUIRED', items, options: [],
    creditsRequired: round(items.reduce((sum, item) => sum + item.credits, 0)),
    creditsCompleted: sumCredits(items, 'COMPLETED'),
    creditsInProgress: sumCredits(items, 'IN_PROGRESS')
  }));
  const electives: RequirementGroup[] = rules.electivePools.map(pool => {
    const taken = pool.courseCodes.filter(code => transcript.some(entry => entry.courseCode === code));
    const items = taken.map(code => {
      const credits = transcript.filter(entry => entry.courseCode === code).at(-1)?.credits ?? 1;
      return itemFor(code, credits, electiveMinimum(pool, code), transcript);
    });
    return {
      category: pool.category, kind: 'ELECTIVE', items,
      creditsRequired: pool.creditsRequired,
      creditsCompleted: sumCredits(items, 'COMPLETED'),
      creditsInProgress: sumCredits(items, 'IN_PROGRESS'),
      options: pool.courseCodes.filter(code => !taken.includes(code))
    };
  });
  return [...required, ...electives];
}
