import type { WorkbookRow } from './workbook-extract.js';

/**
 * Reads one programme sheet of the Registry's degree audit workbook into requirement lines
 * and recomputes every category, section and overall total for both maths tracks, so
 * printed totals can be checked against their components (master build prompt §3.3).
 *
 * The workbook names courses but gives no course codes; codes come from a separate
 * Registry-confirmed mapping. Nothing here guesses one.
 */

export type LineKind =
  /** A required course. */
  | 'COURSE'
  /** "Pre-Calculus 1 / Calculus 1": one course whose name depends on the track. */
  | 'ALTERNATIVE'
  /** "Applied Calc (Pre-Calc track only)": counts only on the alternate track. */
  | 'ALTERNATE_TRACK_ONLY'
  /** "2 CS Electives": a number of elective slots. */
  | 'ELECTIVE_SLOTS'
  /** "Capstone 1 (could be CS elective)": required, with a note on how it may count. */
  | 'CONDITIONAL_CAPSTONE';

export interface RequirementLine {
  kind: LineKind;
  name: string;
  section: string;
  category: string;
  credits: number;
  sourceRow: number;
  /** Elective slots that must be African Studies. */
  africanStudiesMinimum?: number;
  /** Free elective slots (major or non-major) inside a non-major elective line. */
  freeElectiveSlots?: number;
}

export interface PrintedTotal {
  scope: 'CATEGORY' | 'SECTION' | 'OVERALL';
  section: string;
  /** The category, or the section's or overall row label. */
  label: string;
  credits: number;
  /** The "(n if … track)" figure printed under it, when there is one. */
  alternateCredits?: number;
  sourceRow: number;
}

export type Track = 'standard' | 'alternate';

export interface Discrepancy {
  code: 'CATEGORY_TOTAL_MISMATCH' | 'SECTION_TOTAL_MISMATCH' | 'SECTION_PRINTED_SUM_MISMATCH' | 'OVERALL_TOTAL_MISMATCH' | 'OVERALL_PRINTED_SUM_MISMATCH' | 'CATEGORY_WITHOUT_TOTAL';
  label: string;
  track: Track;
  /** Credits the listed components add up to (or the printed parts, for *_PRINTED_SUM_*). */
  computed: number;
  /** Credits printed in the workbook; null when nothing is printed. */
  printed: number | null;
  sourceRow: number;
}

export interface ProgrammeReconciliation {
  /** The alternate track as printed, e.g. "Pre-Calc" or "Calc1&2"; null when the sheet has one track. */
  alternateTrack: string | null;
  lines: RequirementLine[];
  totals: PrintedTotal[];
  /** Computed credits per category, section and overall, for each track. */
  computed: Record<Track, { categories: Record<string, number>; sections: Record<string, number>; overall: number }>;
  discrepancies: Discrepancy[];
}

const TOTAL = /^(\d+(?:\.\d+)?)\s*(?:Ashesi\s+)?Credits?$/i;
const ALTERNATE_TOTAL = /^\((\d+(?:\.\d+)?)\s+if\s+(.+?)\s+track\)$/i;
const ELECTIVES = /^(\d+)\s+(?:[\w-]+\s+)*?Electives?\b/i;
const FREE_ELECTIVES = /\band\s+(\d+)\s+Free\s+Electives?\b/i;
const AFRICAN = /at\s+least\s+(\d+)\s+African\s+studies/i;
const TRACK_ONLY = /\((?:[^)]*\btrack\s+only|only\s+if\b[^)]*)\)/i;

const text = (cell: unknown) => (typeof cell === 'string' ? cell.replace(/\s+/g, ' ').trim() : '');
const round = (value: number) => Math.round(value * 100) / 100;

function lineFor(name: string, section: string, category: string, sourceRow: number): RequirementLine | null {
  if (!name || /^none$/i.test(name)) return null;
  const base = { name, section, category, sourceRow };
  const electives = name.match(ELECTIVES);
  if (electives) {
    const free = Number(name.match(FREE_ELECTIVES)?.[1] ?? 0);
    const african = Number(name.match(AFRICAN)?.[1] ?? 0);
    return {
      ...base, kind: 'ELECTIVE_SLOTS', credits: Number(electives[1]) + free,
      ...(african ? { africanStudiesMinimum: african } : {}),
      ...(free ? { freeElectiveSlots: free } : {})
    };
  }
  const credits = name.includes('*') ? 0.5 : 1;
  if (TRACK_ONLY.test(name)) return { ...base, kind: 'ALTERNATE_TRACK_ONLY', credits };
  // "CAD/CAM" is one course; alternatives are written with spaces around the slash.
  if (name.includes(' / ')) return { ...base, kind: 'ALTERNATIVE', credits };
  if (/\(could be\b/i.test(name)) return { ...base, kind: 'CONDITIONAL_CAPSTONE', credits };
  return { ...base, kind: 'COURSE', credits };
}

export function creditsOn(line: RequirementLine, track: Track): number {
  return line.kind === 'ALTERNATE_TRACK_ONLY' && track === 'standard' ? 0 : line.credits;
}

/** Reads columns A (section), B (category or total label) and C (course or credits) of one sheet. */
export function reconcileProgramme(rows: WorkbookRow[]): ProgrammeReconciliation {
  const lines: RequirementLine[] = [];
  const totals: PrintedTotal[] = [];
  let section = '';
  let category = '';
  let alternateTrack: string | null = null;

  // Requirements start after the column headings ("Completed?"); above them are the title and student fields.
  const header = rows.findIndex(row => /^completed\?/i.test(text(row.cells[3])));
  for (const { sourceRow, cells } of rows.slice(header + 1)) {
    const [a, b, c] = [text(cells[0]), text(cells[1]), text(cells[2])];
    if (/^\*\s*indicates/i.test(a)) continue;
    if (a) section = a;
    if (!section) continue;

    const alternate = c.match(ALTERNATE_TOTAL);
    if (alternate) {
      alternateTrack ??= alternate[2];
      const last = totals.at(-1);
      if (last) last.alternateCredits = Number(alternate[1]);
      continue;
    }

    const printed = c.match(TOTAL);
    if (/^total credits overall$/i.test(b)) {
      if (printed) totals.push({ scope: 'OVERALL', section, label: b, credits: Number(printed[1]), sourceRow });
      continue;
    }
    if (/^total credits\b/i.test(b)) {
      if (printed) totals.push({ scope: 'SECTION', section, label: b, credits: Number(printed[1]), sourceRow });
      continue;
    }
    if (b) category = b;
    if (printed) {
      totals.push({ scope: 'CATEGORY', section, label: category, credits: Number(printed[1]), sourceRow });
      continue;
    }
    const line = lineFor(c, section, category, sourceRow);
    if (line) lines.push(line);
  }

  const computed = {} as ProgrammeReconciliation['computed'];
  const discrepancies: Discrepancy[] = [];
  const categoryTotals = totals.filter(total => total.scope === 'CATEGORY');
  const sectionTotals = totals.filter(total => total.scope === 'SECTION');
  const overall = totals.find(total => total.scope === 'OVERALL');
  const tracks: Track[] = alternateTrack ? ['standard', 'alternate'] : ['standard'];
  const printedFor = (total: PrintedTotal, track: Track) =>
    track === 'alternate' ? total.alternateCredits ?? total.credits : total.credits;
  const sectionOf = (label: string) => lines.find(line => line.category === label)?.section ?? categoryTotals.find(total => total.label === label)?.section ?? '';

  for (const track of tracks) {
    const categories: Record<string, number> = {};
    for (const line of lines) categories[line.category] = round((categories[line.category] ?? 0) + creditsOn(line, track));
    for (const total of categoryTotals) categories[total.label] ??= 0;
    const sections: Record<string, number> = {};
    for (const [label, credits] of Object.entries(categories)) {
      // Credits of a category with no printed total are unknown (LLB's IAP courses), so they stay out of the sums.
      if (!categoryTotals.some(total => total.label === label)) continue;
      const owner = sectionOf(label);
      sections[owner] = round((sections[owner] ?? 0) + credits);
    }
    const overallCredits = round(Object.values(sections).reduce((sum, credits) => sum + credits, 0));
    computed[track] = { categories, sections, overall: overallCredits };

    for (const [label, credits] of Object.entries(categories)) {
      const total = categoryTotals.find(candidate => candidate.label === label);
      if (!total) {
        if (track === 'standard') {
          const firstRow = lines.find(line => line.category === label)?.sourceRow ?? 0;
          discrepancies.push({ code: 'CATEGORY_WITHOUT_TOTAL', label, track, computed: credits, printed: null, sourceRow: firstRow });
        }
        continue;
      }
      const expected = printedFor(total, track);
      if (credits !== expected) discrepancies.push({ code: 'CATEGORY_TOTAL_MISMATCH', label, track, computed: credits, printed: expected, sourceRow: total.sourceRow });
    }
    for (const total of sectionTotals) {
      const expected = printedFor(total, track);
      const fromLines = sections[total.section] ?? 0;
      if (fromLines !== expected) discrepancies.push({ code: 'SECTION_TOTAL_MISMATCH', label: total.label, track, computed: fromLines, printed: expected, sourceRow: total.sourceRow });
      const fromPrinted = round(categoryTotals.filter(category => category.section === total.section).reduce((sum, category) => sum + printedFor(category, track), 0));
      if (fromPrinted !== expected) discrepancies.push({ code: 'SECTION_PRINTED_SUM_MISMATCH', label: total.label, track, computed: fromPrinted, printed: expected, sourceRow: total.sourceRow });
    }
    if (overall) {
      const expected = printedFor(overall, track);
      if (overallCredits !== expected) discrepancies.push({ code: 'OVERALL_TOTAL_MISMATCH', label: overall.label, track, computed: overallCredits, printed: expected, sourceRow: overall.sourceRow });
      const fromSections = round(sectionTotals.reduce((sum, total) => sum + printedFor(total, track), 0));
      if (sectionTotals.length && fromSections !== expected) {
        discrepancies.push({ code: 'OVERALL_PRINTED_SUM_MISMATCH', label: overall.label, track, computed: fromSections, printed: expected, sourceRow: overall.sourceRow });
      }
    }
  }
  return { alternateTrack, lines, totals, computed, discrepancies };
}
