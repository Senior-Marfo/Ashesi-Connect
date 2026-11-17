import type { CourseSummary, StudentSummary } from '../repositories/types.js';

/** Factual flags from course records alone; none of them is a graduation decision. */
export const REGISTER_FLAGS = ['UNRESOLVED_FAILURE', 'INCOMPLETE', 'NO_RECORDS'] as const;
export type RegisterFlag = (typeof REGISTER_FLAGS)[number];

export const REGISTER_SORTS = ['studentId', 'fullName', 'programme', 'yearGroup', 'passedCredits', 'inProgressCredits', 'unresolvedFailures'] as const;
export type RegisterSort = (typeof REGISTER_SORTS)[number];

export interface RegisterRow extends StudentSummary, Omit<CourseSummary, 'studentId'> {
  flags: RegisterFlag[];
  /** Severity needs a Registry-reviewed curriculum, so it stays undetermined until one is loaded. */
  severity: 'UNDETERMINED';
}

export interface RegisterQuery {
  flag?: RegisterFlag;
  sort: RegisterSort;
  order: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface RegisterPage {
  rows: RegisterRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  counts: { students: number } & Record<RegisterFlag, number>;
}

const EMPTY: Omit<CourseSummary, 'studentId'> = { coursesOnRecord: 0, passedCredits: 0, inProgressCredits: 0, unresolvedFailures: 0, incompletes: 0 };

export function registerRows(students: StudentSummary[], summaries: CourseSummary[]): RegisterRow[] {
  const byStudent = new Map(summaries.map(summary => [summary.studentId, summary]));
  return students.map(student => {
    const { studentId: _ignored, ...facts } = byStudent.get(student.studentId) ?? { studentId: student.studentId, ...EMPTY };
    const flags: RegisterFlag[] = [];
    if (facts.unresolvedFailures > 0) flags.push('UNRESOLVED_FAILURE');
    if (facts.incompletes > 0) flags.push('INCOMPLETE');
    if (facts.coursesOnRecord === 0) flags.push('NO_RECORDS');
    return { ...student, ...facts, flags, severity: 'UNDETERMINED' };
  });
}

export function filterAndSort(rows: RegisterRow[], query: Pick<RegisterQuery, 'flag' | 'sort' | 'order'>): RegisterRow[] {
  const direction = query.order === 'asc' ? 1 : -1;
  return rows
    .filter(row => !query.flag || row.flags.includes(query.flag))
    .sort((a, b) => {
      const left = a[query.sort];
      const right = b[query.sort];
      const primary = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
      return primary * direction || a.studentId.localeCompare(b.studentId);
    });
}

export function buildRegister(students: StudentSummary[], summaries: CourseSummary[], query: RegisterQuery): RegisterPage {
  const rows = registerRows(students, summaries);
  const matching = filterAndSort(rows, query);
  const pageCount = Math.max(1, Math.ceil(matching.length / query.pageSize));
  const page = Math.min(query.page, pageCount);
  const counts = { students: rows.length, UNRESOLVED_FAILURE: 0, INCOMPLETE: 0, NO_RECORDS: 0 };
  for (const row of rows) for (const flag of row.flags) counts[flag] += 1;
  return {
    rows: matching.slice((page - 1) * query.pageSize, page * query.pageSize),
    total: matching.length,
    page,
    pageSize: query.pageSize,
    pageCount,
    counts
  };
}

const CSV_COLUMNS: Array<[string, (row: RegisterRow) => string | number]> = [
  ['Student ID', row => row.studentId],
  ['Name', row => row.fullName],
  ['Programme', row => row.programme],
  ['Year group', row => row.yearGroup],
  ['Track', row => row.track],
  ['Passed credits (provisional D+ pass mark)', row => row.passedCredits],
  ['Credits in progress', row => row.inProgressCredits],
  ['Failed courses not yet retaken', row => row.unresolvedFailures],
  ['Incomplete courses', row => row.incompletes],
  ['Courses on record', row => row.coursesOnRecord],
  ['Flags', row => row.flags.join(' ')],
  ['Synthetic record', row => (row.synthetic ? 'yes' : 'no')]
];

/** RFC 4180 CSV; cells starting with spreadsheet formula characters are prefixed so they stay text. */
export function registerCsv(rows: RegisterRow[]): string {
  const cell = (value: string | number) => {
    const text = String(value);
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  const lines = [CSV_COLUMNS.map(([heading]) => cell(heading)).join(','), ...rows.map(row => CSV_COLUMNS.map(([, read]) => cell(read(row))).join(','))];
  return `${lines.join('\r\n')}\r\n`;
}
