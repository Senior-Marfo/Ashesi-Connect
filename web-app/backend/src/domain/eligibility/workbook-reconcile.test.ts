import { describe, expect, it } from 'vitest';
import { creditsOn, reconcileProgramme } from './workbook-reconcile.js';
import { mappingTemplateCsv, reconciliationReport, suggestAlternateOption } from './workbook-report.js';

type Cells = [string?, string?, string?, string?];
const sheet = (...lines: Cells[]) => lines.map((cells, index) => ({ sourceRow: index + 1, cells: cells.map(cell => cell ?? null) }));
const HEADER: Cells[] = [['ASHESI UNIVERSITY DEGREE AUDIT'], [undefined, 'Student name:'], [undefined, undefined, 'Computer Science', 'Completed?\n(Indicate…)']];

/** A small programme shaped like the real sheets, whose totals all reconcile. */
const consistent = sheet(
  ...HEADER,
  ['LIBERAL ARTS & SCIENCES CORE', 'Humanities', 'Written and Oral Comm.'],
  [undefined, undefined, 'Leadership 1*'],
  [undefined, undefined, '1.5 Ashesi Credits'],
  [undefined, 'Mathematics & Quantitative', 'Pre-Calculus 1 / Calculus 1'],
  [undefined, undefined, 'Applied Calc (Pre-Calc track only)'],
  [undefined, undefined, 'Statistics'],
  [undefined, undefined, '2 Ashesi Credits'],
  [undefined, undefined, '(3 if Pre-Calc track)'],
  [undefined, 'Non-Major Electives', '2 Non-Major Electives (at least 1 African studies)', '[1]'],
  [undefined, undefined, 'None', '[2]'],
  [undefined, undefined, '2 Ashesi Credits'],
  [undefined, 'Total Credits - Liberal Arts & Sciences Core', '5.5 Ashesi Credits'],
  [undefined, undefined, '(6.5 if Pre-Calc track)'],
  ['MAJOR', 'Required Major Classes', 'CAD/CAM'],
  [undefined, undefined, 'Capstone 1 (could be CS elective)'],
  [undefined, undefined, '2 Ashesi Credits'],
  [undefined, 'Total Credits - Major', '2 Credits'],
  [undefined, 'TOTAL CREDITS OVERALL', '7.5 Ashesi Credits'],
  [undefined, undefined, '(8.5 if Pre-Calc track)'],
  ['* Indicates 0.5 credit course']
);

describe('workbook reconciliation', () => {
  it('reads only the requirement rows, classifying each line', () => {
    const result = reconcileProgramme(consistent);
    expect(result.alternateTrack).toBe('Pre-Calc');
    expect(result.lines.map(line => [line.name, line.kind, line.credits])).toEqual([
      ['Written and Oral Comm.', 'COURSE', 1],
      ['Leadership 1*', 'COURSE', 0.5],
      ['Pre-Calculus 1 / Calculus 1', 'ALTERNATIVE', 1],
      ['Applied Calc (Pre-Calc track only)', 'ALTERNATE_TRACK_ONLY', 1],
      ['Statistics', 'COURSE', 1],
      ['2 Non-Major Electives (at least 1 African studies)', 'ELECTIVE_SLOTS', 2],
      ['CAD/CAM', 'COURSE', 1],
      ['Capstone 1 (could be CS elective)', 'CONDITIONAL_CAPSTONE', 1]
    ]);
    expect(result.lines.find(line => line.kind === 'ELECTIVE_SLOTS')?.africanStudiesMinimum).toBe(1);
    expect(result.lines.every(line => line.category !== 'Student name:')).toBe(true);
  });

  it('agrees with every printed total on both tracks when the sheet is consistent', () => {
    const result = reconcileProgramme(consistent);
    expect(result.discrepancies).toEqual([]);
    expect(result.computed.standard.overall).toBe(7.5);
    expect(result.computed.alternate.overall).toBe(8.5);
    expect(result.computed.alternate.categories['Mathematics & Quantitative']).toBe(3);
  });

  it('counts track-only courses on the alternate track only', () => {
    const line = reconcileProgramme(consistent).lines.find(candidate => candidate.kind === 'ALTERNATE_TRACK_ONLY')!;
    expect(creditsOn(line, 'standard')).toBe(0);
    expect(creditsOn(line, 'alternate')).toBe(1);
  });

  it('reports a category whose courses miss its printed total, and a section total that disagrees with its parts', () => {
    const rows = sheet(
      ...HEADER,
      ['MAJOR', 'Required Major Classes', 'Course A'],
      [undefined, undefined, 'Course B*'],
      [undefined, undefined, '1 Ashesi Credit'],
      [undefined, 'Major Electives', '2 CS Electives'],
      [undefined, undefined, '2 Ashesi Credits'],
      [undefined, 'Total Credits - Major', '4 Credits'],
      [undefined, 'TOTAL CREDITS OVERALL', '4 Ashesi Credits']
    );
    const codes = reconcileProgramme(rows).discrepancies.map(d => [d.code, d.label, d.computed, d.printed]);
    expect(codes).toEqual([
      ['CATEGORY_TOTAL_MISMATCH', 'Required Major Classes', 1.5, 1],
      ['SECTION_TOTAL_MISMATCH', 'Total Credits - Major', 3.5, 4],
      ['SECTION_PRINTED_SUM_MISMATCH', 'Total Credits - Major', 3, 4],
      ['OVERALL_TOTAL_MISMATCH', 'TOTAL CREDITS OVERALL', 3.5, 4]
    ]);
  });

  it('flags courses listed without any credit total and leaves them out of the sums', () => {
    const rows = sheet(
      ...HEADER,
      ['MAJOR', 'Required Major Classes', 'Course A'],
      [undefined, undefined, '1 Ashesi Credit'],
      [undefined, 'Total Credits - Major', '1 Credits'],
      ['IAP', 'IAP', 'Legal Reasoning'],
      [undefined, undefined, 'Language for Law'],
      [undefined, 'TOTAL CREDITS OVERALL', '1 Ashesi Credits']
    );
    const result = reconcileProgramme(rows);
    expect(result.discrepancies).toEqual([{ code: 'CATEGORY_WITHOUT_TOTAL', label: 'IAP', track: 'standard', computed: 2, printed: null, sourceRow: 7 }]);
    expect(result.computed.standard.overall).toBe(1);
  });

  it('counts a free elective written into a non-major elective line', () => {
    const rows = sheet(...HEADER, ['LIBERAL ARTS & SCIENCES CORE', 'Non-Major Electives', '2 Non-Major Electives (at least 1 African studies) and 1 Free Elective (major or non-major)']);
    const line = reconcileProgramme(rows).lines[0];
    expect(line).toMatchObject({ kind: 'ELECTIVE_SLOTS', credits: 3, freeElectiveSlots: 1, africanStudiesMinimum: 1 });
  });
});

describe('reconciliation outputs', () => {
  it('suggests which option of an either/or course belongs to the alternate track', () => {
    expect(suggestAlternateOption(['Pre-Calculus 1', 'Calculus 1'], 'Pre-Calc')).toBe(0);
    expect(suggestAlternateOption(['Calculus for Engineering', 'Calc 1'], 'Calc1&2')).toBe(1);
    expect(suggestAlternateOption(['Option A', 'Option B'], 'Pre-Calc')).toBeNull();
    expect(suggestAlternateOption(['Pre-Calculus 1', 'Calculus 1'], null)).toBeNull();
  });

  it('writes a mapping template with blank codes, one row per course option', () => {
    const csv = mappingTemplateCsv([{ programme: 'CS', reconciliation: reconcileProgramme(consistent) }]);
    const rows = csv.trim().split('\r\n');
    expect(rows[0]).toBe('programme,section,category,kind,workbook_name,credits,track,source_row,course_code,minimum_grade,notes');
    expect(rows).toContain('CS,LIBERAL ARTS & SCIENCES CORE,Mathematics & Quantitative,ALTERNATIVE,Pre-Calculus 1,1,alternate (Pre-Calc),7,,,One of: Pre-Calculus 1 / Calculus 1. Track suggested from the printed track name; confirm.');
    expect(rows).toContain('CS,LIBERAL ARTS & SCIENCES CORE,Mathematics & Quantitative,ALTERNATIVE,Calculus 1,1,standard,7,,,One of: Pre-Calculus 1 / Calculus 1. Track suggested from the printed track name; confirm.');
    expect(rows.slice(1).every(row => row.split(',')[8] === '')).toBe(true);
    expect(rows).toHaveLength(1 + 9);
  });

  it('summarises every programme in the report, including clean ones', () => {
    const report = reconciliationReport([{ programme: 'CS', reconciliation: reconcileProgramme(consistent) }], 'abc123');
    expect(report).toContain('SHA-256 `abc123`');
    expect(report).toContain('| CS | Pre-Calc | 7.5 / 8.5 | 7.5 / 8.5 | none |');
    expect(report).toContain('Every printed total matches its components.');
  });
});
