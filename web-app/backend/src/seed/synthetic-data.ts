/**
 * Deterministic synthetic academic records for demonstrations and testing.
 * Course codes and plans are illustrative, NOT the official Ashesi curriculum.
 * Every generated document carries `synthetic: true` and a student ID in the
 * reserved 9xxxxxxx range so it can be removed without touching real records.
 */

export const PROGRAMMES = ['BA', 'ECON', 'LLB', 'MIS', 'CS', 'CE', 'EE', 'ME', 'MT', 'BE'] as const;
export type Programme = (typeof PROGRAMMES)[number];

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

interface Course { code: string; credits: number }

const ENGINEERING: ReadonlySet<Programme> = new Set(['CE', 'EE', 'ME', 'MT', 'BE']);
const MAJOR_PREFIX: Record<Programme, string> = { BA: 'BUSA', ECON: 'ECON', LLB: 'LAW', MIS: 'MIS', CS: 'CS', CE: 'CE', EE: 'EE', ME: 'ME', MT: 'MT', BE: 'BE' };
const PASSING = new Set(['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+']);
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

/** An illustrative eight-semester plan: liberal arts core first, major depth later, capstone last. */
function coursePlan(programme: Programme, track: string, next: () => number): Course[] {
  const p = MAJOR_PREFIX[programme];
  const one = (code: string): Course => ({ code, credits: 1 });
  const half = (code: string): Course => ({ code, credits: 0.5 });
  const maths = ENGINEERING.has(programme)
    ? [...(track === 'calculus-1-2' ? [one('MATH 141')] : []), one('MATH 142'), one('MATH 211'), one('MATH 221')]
    : [...(track === 'pre-calculus' ? [one('MATH 101')] : []), one('MATH 121'), one('MATH 141')];
  const science = ENGINEERING.has(programme) ? [one('PHYS 141'), one('PHYS 142'), one('CHEM 141'), one('ENGR 112'), one('MATH 222')] : [];
  // LLB's IAP: Legal Reasoning, Language for Law, Advanced Language for Law, Advanced Legal Writing.
  const iap = programme === 'LLB' ? [one('LAW 101'), one('LAW 102'), one('LAW 201'), one('LAW 202')] : [];
  const major = (levels: number[]) => levels.map(level => one(`${p} ${level}`));
  const africanStudies = pick(next, ['SOAN 211', 'HIST 211', 'SOAN 311', 'ENGL 213']);
  const nonMajor = shuffle(next, ['SOAN 221', 'PHIL 211', 'ARTS 211', 'ENGL 221', 'SOAN 231', 'POLS 211']).slice(0, 2);
  const electives = shuffle(next, [`${p} 351`, `${p} 352`, `${p} 361`, `${p} 362`, `${p} 451`, `${p} 452`]).slice(0, 4);
  return [
    one('WRIT 111'), half('LEAD 111'), one('BUSA 161'), maths[0], one('CS 111'),
    one('ENGL 112'), half('LEAD 211'), one('BUSA 162'), ...iap, ...maths.slice(1), ...science,
    ...major([211, 212, 221, 222, 231, 232]), one('ECON 101'), half('LEAD 311'), one(africanStudies),
    ...major([311, 312, 321, 322, 331, 341]), ...nonMajor.map(one), one('RES 311'),
    ...electives.map(one), ...major([411, 412, 421]), one('LEAD 411'),
    one(`${p} 400`)
  ];
}

function termLabel(entryYear: number, index: number): { label: string; ordinal: number } {
  const fall = index % 2 === 0;
  const year = fall ? entryYear + index / 2 : entryYear + (index + 1) / 2;
  return { label: `${year} ${fall ? 'Fall' : 'Spring'}`, ordinal: year * 2 + (fall ? 1 : 0) };
}

/** Ordinal of the term in progress (Spring = 2Y, Fall = 2Y + 1), or of the last finished term between terms. */
function currentTerm(today: Date): { ordinal: number; inProgress: boolean } {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;
  if (month >= 8) return { ordinal: year * 2 + 1, inProgress: true };
  if (month <= 5) return { ordinal: year * 2, inProgress: true };
  return { ordinal: year * 2, inProgress: false };
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

    const ability = 0.45 + gaussian(next) * 0.75;
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
      const load = lighterLoad ? 3.5 : term === 7 ? 6 : fullLoad;
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
          continue;
        }
        const grade = gradeFor(ability + gaussian(next) * 0.5);
        attempts.push({ credits: course.credits, grade, status: 'COMPLETED', semester: label });
        if (!PASSING.has(grade) && next() < 0.85) retakes.push(course);
      }
      queue.unshift(...retakes);
    }

    for (const [courseCode, attempts] of records) enrollments.push({ studentId, courseCode, attempts, synthetic: true });
  }
  return { students, enrollments };
}
