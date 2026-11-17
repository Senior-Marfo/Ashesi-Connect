import { parseCsv } from '../../imports/csv.js';
import { COURSE_CODE } from '../../imports/validate.js';
import { curriculumDraftSchema, planCurriculumDraftImport } from './curriculum-import.js';
import { MAPPING_COLUMNS } from './workbook-report.js';
import type { z } from 'zod';

/**
 * Turns the Registry-completed course mapping (docs/02-requirements/degree-audit-2028/
 * curriculum-course-mapping.csv) into curriculum drafts, one per programme and maths track.
 * Every row is checked; a programme with any problem gets no draft.
 */

export type CurriculumDraft = z.infer<typeof curriculumDraftSchema>;
export type AppTrack = 'standard' | 'pre-calculus' | 'calculus-1-2';

export interface DraftOptions {
  /** Version label stored on every draft, e.g. "2028-v1". */
  version: string;
  /** Where the Registry publishes the source workbook (HTTPS). */
  sourceUrl: string;
  retrievedAt: string;
  effectiveYear: number;
  workbookSha256: string;
}

export interface MappingIssue {
  /** Spreadsheet row number (the header is row 1); 0 for whole-programme problems. */
  row: number;
  programme: string;
  message: string;
}

export interface BuiltDraft {
  programme: string;
  track: AppTrack;
  draft: CurriculumDraft;
  requiredCredits: number;
  electiveCredits: number;
  /** Required courses left out because the mapping gives them 0 credits (for example LLB's IAP). */
  zeroCreditCourses: string[];
}

interface MappingRow {
  row: number;
  programme: string;
  category: string;
  kind: string;
  name: string;
  credits: number;
  track: string;
  code: string;
  minimumGrade: string;
}

const KINDS = new Set(['COURSE', 'ALTERNATIVE', 'ALTERNATE_TRACK_ONLY', 'ELECTIVE_SLOTS', 'CONDITIONAL_CAPSTONE']);
const PASS_MARKS = new Set(['', 'D+', 'C']);
const AFRICAN = /at\s+least\s+(\d+)\s+African\s+studies/i;
const round = (value: number) => Math.round(value * 100) / 100;

/** "alternate (Pre-Calc)" → pre-calculus; "alternate (Calc1&2)" → calculus-1-2. */
function alternateTrackOf(track: string): AppTrack | null {
  const label = track.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (label.includes('precalc')) return 'pre-calculus';
  if (label.includes('calc12')) return 'calculus-1-2';
  return null;
}

function readRows(text: string): { rows: MappingRow[]; issues: MappingIssue[] } {
  let table: string[][];
  try {
    table = parseCsv(text);
  } catch {
    return { rows: [], issues: [{ row: 0, programme: '', message: 'The file is not valid CSV: a quoted field is never closed.' }] };
  }
  const [header = [], ...body] = table;
  if (header.map(cell => cell.trim().toLowerCase()).join(',') !== MAPPING_COLUMNS.join(',')) {
    return { rows: [], issues: [{ row: 1, programme: '', message: `The header must be exactly: ${MAPPING_COLUMNS.join(',')}` }] };
  }
  const at = (cells: string[], column: string) => (cells[MAPPING_COLUMNS.indexOf(column)] ?? '').trim();
  return {
    issues: [],
    rows: body.map((cells, index) => ({
      row: index + 2,
      programme: at(cells, 'programme').toUpperCase(),
      category: at(cells, 'category'),
      kind: at(cells, 'kind'),
      name: at(cells, 'workbook_name'),
      credits: Number(at(cells, 'credits')),
      track: at(cells, 'track'),
      code: at(cells, 'course_code').toUpperCase().replace(/\s+/g, ' ').replace(/^([A-Z]{2,5})\s*(\d)/, '$1 $2'),
      minimumGrade: at(cells, 'minimum_grade').toUpperCase()
    }))
  };
}

function checkRow(row: MappingRow): string[] {
  const problems: string[] = [];
  if (!KINDS.has(row.kind)) problems.push(`Unknown kind "${row.kind}".`);
  if (!Number.isFinite(row.credits) || row.credits < 0 || row.credits > 10) problems.push(`Credits "${row.credits}" are not a number from 0 to 10.`);
  if (!PASS_MARKS.has(row.minimumGrade)) problems.push(`minimum_grade must be blank (D+), D+ or C, not "${row.minimumGrade}".`);
  if (row.track === 'confirm' || (row.track !== 'both' && row.track !== 'standard' && !alternateTrackOf(row.track))) {
    problems.push(`Set track to "standard" or the alternate track shown for this programme (was "${row.track}").`);
  }
  if (row.kind === 'ELECTIVE_SLOTS') {
    const codes = electiveCodes(row.code).map(code => code.replace(/\*$/, ''));
    if (row.credits > 0 && codes.length === 0) problems.push(`List the courses allowed for "${row.name}" in course_code, separated by semicolons.`);
    for (const code of codes) if (!COURSE_CODE.test(code)) problems.push(`"${code}" is not a course code like CS 351.`);
  } else if (row.credits > 0 && !COURSE_CODE.test(row.code)) {
    problems.push(row.code ? `"${row.code}" is not a course code like CS 212.` : `Add the course code for "${row.name}".`);
  }
  return problems;
}

/** "CS 351; CS 352; AS 101*" → codes, each normalised like imports ("cs351" → "CS 351"); a trailing * marks African Studies. */
function electiveCodes(cell: string): string[] {
  return cell.split(';').map(code => code.trim().replace(/^([A-Z]{2,5})\s*(\d)/, '$1 $2')).filter(Boolean);
}

function appliesTo(row: MappingRow, track: AppTrack): boolean {
  if (row.track === 'both') return true;
  if (row.track === 'standard') return track === 'standard';
  return alternateTrackOf(row.track) === track;
}

export function buildCurriculumDrafts(text: string, options: DraftOptions): { drafts: BuiltDraft[]; issues: MappingIssue[] } {
  const { rows, issues } = readRows(text);
  if (issues.length) return { drafts: [], issues };
  for (const row of rows) for (const message of checkRow(row)) issues.push({ row: row.row, programme: row.programme, message });

  const drafts: BuiltDraft[] = [];
  const programmes = [...new Set(rows.map(row => row.programme))];
  for (const programme of programmes) {
    if (issues.some(issue => issue.programme === programme)) continue;
    const own = rows.filter(row => row.programme === programme);
    const alternates = new Set(own.map(row => alternateTrackOf(row.track)).filter((track): track is AppTrack => track !== null));
    if (alternates.size > 1) {
      issues.push({ row: 0, programme, message: 'Rows name more than one alternate track.' });
      continue;
    }
    for (const track of ['standard', ...alternates] as AppTrack[]) {
      const applicable = own.filter(row => appliesTo(row, track));
      const required = applicable.filter(row => row.kind !== 'ELECTIVE_SLOTS');
      const zeroCreditCourses = required.filter(row => row.credits === 0).map(row => row.name);
      const requiredCourses = required.filter(row => row.credits > 0).map(row => ({
        courseCode: row.code,
        credits: row.credits,
        minimumGrade: (row.minimumGrade || 'D+') as 'D+' | 'C',
        category: row.category
      }));
      const electivePools = applicable.filter(row => row.kind === 'ELECTIVE_SLOTS').map(row => {
        const listed = electiveCodes(row.code);
        const courseCodes = listed.map(code => code.replace(/\*$/, ''));
        const africanStudiesCodes = listed.filter(code => code.endsWith('*')).map(code => code.slice(0, -1));
        const africanStudiesMinimum = Number(row.name.match(AFRICAN)?.[1] ?? 0);
        return {
          category: row.category,
          creditsRequired: row.credits,
          courseCodes,
          ...(africanStudiesMinimum ? { africanStudiesMinimum, africanStudiesCodes } : {}),
          ...(row.minimumGrade ? { minimumGrade: row.minimumGrade as 'D+' | 'C' } : {})
        };
      });
      const requiredCredits = round(requiredCourses.reduce((sum, course) => sum + course.credits, 0));
      const electiveCredits = round(electivePools.reduce((sum, pool) => sum + pool.creditsRequired, 0));
      const draft: CurriculumDraft = {
        version: options.version,
        status: 'DRAFT',
        rules: {
          programme,
          track,
          // From the components: several printed totals in the 2028 workbook disagree with them.
          totalCredits: round(requiredCredits + electiveCredits),
          verifiedByRegistry: false,
          requiredCourses,
          electivePools
        },
        sources: [{
          sourceUrl: options.sourceUrl,
          sourceKind: 'REGISTRY_PROVIDED_WORKBOOK',
          retrievedAt: options.retrievedAt,
          effectiveYear: options.effectiveYear,
          contentHash: options.workbookSha256
        }],
        sourceWorkbookHash: options.workbookSha256
      };
      const plan = planCurriculumDraftImport(draft);
      if (!plan.accepted) {
        for (const issue of plan.issues) issues.push({ row: 0, programme, message: `${track} track draft is invalid: ${issue}` });
        continue;
      }
      drafts.push({ programme, track, draft, requiredCredits, electiveCredits, zeroCreditCourses });
    }
  }
  return { drafts: drafts.filter(built => !issues.some(issue => issue.programme === built.programme)), issues };
}
