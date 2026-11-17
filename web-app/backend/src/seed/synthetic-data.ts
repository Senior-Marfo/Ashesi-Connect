import { currentTerm } from '../domain/eligibility/terms.js';

/**
 * Deterministic synthetic academic records for demonstrations and testing.
 * Course codes and plans are illustrative, NOT the official Ashesi curriculum.
 * Every generated document carries `synthetic: true` and a student ID in the
 * reserved 9xxxxxxx range so it can be removed without touching real records.
 */

import { PROGRAMMES, type Programme } from '../domain/programmes.js';

export { PROGRAMMES, type Programme };

export type AttemptStatus = 'COMPLETED' | 'ENROLLED' | 'INCOMPLETE';
export interface SyntheticAttempt { credits: number; grade?: string; status: AttemptStatus; semester: string }
export interface SyntheticStudent { studentId: string; fullName: string; programme: Programme; yearGroup: number; track: string; synthetic: true }
export interface SyntheticEnrollment { studentId: string; courseCode: string; attempts: SyntheticAttempt[]; synthetic: true }
export interface SyntheticDataset { students: SyntheticStudent[]; enrollments: SyntheticEnrollment[] }

export interface GenerateOptions {
  count?: number;
  seed?: number;
  /** Decides which terms are finished, in progress or still ahead. */
  today?: Date;
  yearGroups?: number[];
}

interface Course { code: string; credits: number; minimumGrade: string }

const ENGINEERING: ReadonlySet<Programme> = new Set(['CE', 'EE', 'ME', 'MT', 'BE']);
const MAJOR_PREFIX: Record<Programme, string> = { BA: 'BUSA', ECON: 'ECON', LLB: 'LAW', MIS: 'MIS', CS: 'CS', CE: 'CE', EE: 'EE', ME: 'ME', MT: 'MT', BE: 'BE' };
const GRADE_ORDER = ['E', 'D', 'D+', 'C', 'C+', 'B', 'B+', 'A', 'A+'];
const meets = (grade: string, minimum: string) => GRADE_ORDER.indexOf(grade) >= GRADE_ORDER.indexOf(minimum);
const GRADE_CUTS: Array<[string, number]> = [['A+', 1.5], ['A', 1.0], ['B+', 0.6], ['B', 0.2], ['C+', -0.2], ['C', -0.65], ['D+', -1.15], ['D', -1.6]];

const FIRST_NAMES = ['Ama', 'Kofi', 'Esi', 'Kwame', 'Akosua', 'Yaw', 'Abena', 'Kwesi', 'Adwoa', 'Kojo', 'Afua', 'Kwabena', 'Efua', 'Nana', 'Yaa', 'Fiifi', 'Akua', 'Kwaku', 'Aba', 'Mawuli', 'Selasi', 'Edem', 'Elikem', 'Dzifa', 'Seyram', 'Naa', 'Nii', 'Adjoa', 'Fatima', 'Ibrahim', 'Amina', 'Abdul', 'Zainab', 'Chidi', 'Ngozi', 'Tunde', 'Wanjiru', 'Kamau', 'Thandiwe', 'Tendai'];
const SURNAMES = ['Mensah', 'Owusu', 'Boateng', 'Asante', 'Osei', 'Agyeman', 'Appiah', 'Darko', 'Addo', 'Amoah', 'Ofori', 'Frimpong', 'Nkrumah', 'Quaye', 'Tetteh', 'Lamptey', 'Ansah', 'Acheampong', 'Bonsu', 'Sarpong', 'Gyamfi', 'Adjei', 'Kumi', 'Danso', 'Agbeko', 'Kpodo', 'Amenyo', 'Dogbe', 'Abubakar', 'Issah', 'Mahama', 'Okafor', 'Adeyemi', 'Mwangi', 'Otieno', 'Ndlovu', 'Moyo', 'Banda', 'Phiri', 'Hammond'];

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(next: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
}

const pick = <T>(next: () => number, items: readonly T[]): T => items[Math.floor(next() * items.length)];

function shuffle<T>(next: () => number, items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function gradeFor(score: number): string {
  return GRADE_CUTS.find(([, cut]) => score > cut)?.[0] ?? 'E';
}

function trackFor(programme: Programme, next: () => number): string {
  if (programme === 'LLB') return 'standard';
  if (ENGINEERING.has(programme)) return next() < 0.3 ? 'calculus-1-2' : 'standard';
  return next() < 0.25 ? 'pre-calculus' : 'standard';
}

export type RequirementCategory =
  | 'Humanities & Social Sciences' | 'Business' | 'Mathematics & Quantitative' | 'Computing'
  | 'Science' | 'Research' | 'IAP' | 'Major' | 'Capstone';

export interface PlannedCourse { code: string; credits: number; category: RequirementCategory; minimumGrade: 'D+' | 'C' }

export const AFRICAN_STUDIES_OPTIONS = ['SOAN 211', 'HIST 211', 'SOAN 311', 'ENGL 213'];
export const NON_MAJOR_OPTIONS = ['SOAN 221', 'PHIL 211', 'ARTS 211', 'ENGL 221', 'SOAN 231', 'POLS 211'];
export const majorElectiveOptions = (programme: Programme) => {
  const p = MAJOR_PREFIX[programme];
  return [`${p} 351`, `${p} 352`, `${p} 361`, `${p} 362`, `${p} 451`, `${p} 452`];
};
export const ELECTIVE_COUNTS = { major: 4, nonMajor: 2, africanStudies: 1 } as const;

/**
 * The fixed (required) courses of the illustrative plan, in the order they are taken,
 * split where the elective choices slot in. Upper-level major courses and the
 * capstone need a C; everything else needs D+.
 */
export function requiredSegments(programme: Programme, track: string) {
  const p = MAJOR_PREFIX[programme];
  const course = (code: string, category: RequirementCategory, credits = 1, minimumGrade: 'D+' | 'C' = 'D+'): PlannedCourse => ({ code, credits, category, minimumGrade });
  const hss = (code: string, credits = 1) => course(code, 'Humanities & Social Sciences', credits);
  const maths = (code: string) => course(code, 'Mathematics & Quantitative');
  const major = (levels: number[], minimumGrade: 'D+' | 'C' = 'D+') => levels.map(level => course(`${p} ${level}`, 'Major', 1, minimumGrade));
  const engineering = ENGINEERING.has(programme);
  const mathsPlan = engineering
    ? [...(track === 'calculus-1-2' ? ['MATH 141'] : []), 'MATH 142', 'MATH 211', 'MATH 221'].map(maths)
    : [...(track === 'pre-calculus' ? ['MATH 101'] : []), 'MATH 121', 'MATH 141'].map(maths);
  const science = engineering
    ? [course('PHYS 141', 'Science'), course('PHYS 142', 'Science'), course('CHEM 141', 'Science'), course('ENGR 112', 'Science'), maths('MATH 222')]
    : [];
  // LLB's IAP: Legal Reasoning, Language for Law, Advanced Language for Law, Advanced Legal Writing.
  const iap = programme === 'LLB' ? ['LAW 101', 'LAW 102', 'LAW 201', 'LAW 202'].map(code => course(code, 'IAP')) : [];
  return {
    beforeAfricanStudies: [
      hss('WRIT 111'), hss('LEAD 111', 0.5), course('BUSA 161', 'Business'), mathsPlan[0], course('CS 111', 'Computing'),
      hss('ENGL 112'), hss('LEAD 211', 0.5), course('BUSA 162', 'Business'), ...iap, ...mathsPlan.slice(1), ...science,
      ...major([211, 212, 221, 222, 231, 232]), hss('ECON 101'), hss('LEAD 311', 0.5)
    ],
    beforeNonMajor: major([311, 312, 321, 322, 331, 341]),
    beforeElectives: [course('RES 311', 'Research')],
    final: [...major([411, 412, 421], 'C'), hss('LEAD 411'), course(`${p} 400`, 'Capstone', 1, 'C')]
  };
}

/** An illustrative eight-semester plan: liberal arts core first, major depth later, capstone last. */
function coursePlan(programme: Programme, track: string, next: () => number): Course[] {
  const one = (code: string): Course => ({ code, credits: 1, minimumGrade: 'D+' });
  const segments = requiredSegments(programme, track);
  const africanStudies = pick(next, AFRICAN_STUDIES_OPTIONS);
  const nonMajor = shuffle(next, NON_MAJOR_OPTIONS).slice(0, ELECTIVE_COUNTS.nonMajor);
  const electives = shuffle(next, majorElectiveOptions(programme)).slice(0, ELECTIVE_COUNTS.major);
  return [
    ...segments.beforeAfricanStudies, one(africanStudies),
    ...segments.beforeNonMajor, ...nonMajor.map(one),
    ...segments.beforeElectives, ...electives.map(one),
    ...segments.final
  ];
}

function termLabel(entryYear: number, index: number): { label: string; ordinal: number } {
  const fall = index % 2 === 0;
  const year = fall ? entryYear + index / 2 : entryYear + (index + 1) / 2;
  return { label: `${year} ${fall ? 'Fall' : 'Spring'}`, ordinal: year * 2 + (fall ? 1 : 0) };
}

export function generateSyntheticDataset(options: GenerateOptions = {}): SyntheticDataset {
  const count = options.count ?? 600;
  const next = random(options.seed ?? 2028);
  const today = options.today ?? new Date();
  const yearGroups = options.yearGroups ?? [2025, 2026, 2027, 2028, 2029, 2030];
  const now = currentTerm(today);
  const students: SyntheticStudent[] = [];
  const enrollments: SyntheticEnrollment[] = [];
  const sequence = new Map<number, number>();

  for (let index = 0; index < count; index += 1) {
    const programme = PROGRAMMES[index % PROGRAMMES.length];
    const yearGroup = yearGroups[Math.floor(index / PROGRAMMES.length) % yearGroups.length];
    const serial = (sequence.get(yearGroup) ?? 0) + 1;
    sequence.set(yearGroup, serial);
    const studentId = `9${String(yearGroup % 100).padStart(2, '0')}${String(serial).padStart(5, '0')}`;
    const track = trackFor(programme, next);
    students.push({ studentId, fullName: `${pick(next, FIRST_NAMES)} ${pick(next, SURNAMES)}`, programme, yearGroup, track, synthetic: true });

    const ability = 0.6 + gaussian(next) * 0.7;
    const lighterLoad = next() < 0.12;
    const queue = coursePlan(programme, track, next);
    const records = new Map<string, SyntheticAttempt[]>();
    const entryYear = yearGroup - 4;

    for (let term = 0; term < 8 && queue.length > 0; term += 1) {
      const { label, ordinal } = termLabel(entryYear, term);
      const finished = ordinal < now.ordinal || (ordinal === now.ordinal && !now.inProgress);
      const enrolled = ordinal === now.ordinal && now.inProgress;
      if (!finished && !enrolled) break;

      const fullLoad = (ENGINEERING.has(programme) || programme === 'LLB' ? 5 : 4.5) + (next() < 0.4 ? 0.5 : 0);
      // The final semester absorbs leftovers up to an overload; anything beyond stays outstanding.
      const load = term === 7 ? 6.5 : lighterLoad ? fullLoad - 0.5 : fullLoad;
      let credits = 0;
      const retakes: Course[] = [];
      while (queue.length > 0 && credits < load) {
        const course = queue.shift() as Course;
        credits += course.credits;
        const attempts = records.get(course.code) ?? [];
        records.set(course.code, attempts);
        if (enrolled) {
          attempts.push({ credits: course.credits, status: 'ENROLLED', semester: label });
          continue;
        }
        if (next() < 0.005) {
          attempts.push({ credits: course.credits, status: 'INCOMPLETE', semester: label });
          if (next() < 0.9) retakes.push(course);
          continue;
        }
        const grade = gradeFor(ability + gaussian(next) * 0.5);
        attempts.push({ credits: course.credits, grade, status: 'COMPLETED', semester: label });
        if (!meets(grade, course.minimumGrade) && next() < 0.9) retakes.push(course);
      }
      queue.unshift(...retakes);
    }

    for (const [courseCode, attempts] of records) enrollments.push({ studentId, courseCode, attempts, synthetic: true });
  }
  return { students, enrollments };
}
