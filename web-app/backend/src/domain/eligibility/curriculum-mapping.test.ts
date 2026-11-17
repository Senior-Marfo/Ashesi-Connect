import { describe, expect, it } from 'vitest';
import { validateCurriculum } from './curriculum-version.js';
import { buildCurriculumDrafts, type DraftOptions } from './curriculum-mapping.js';
import { reconcileProgramme } from './workbook-reconcile.js';
import { MAPPING_COLUMNS, mappingTemplateCsv } from './workbook-report.js';

const options: DraftOptions = {
  version: '2028-v1',
  sourceUrl: 'https://registry.example.edu/degree-audit-2028.xlsx',
  retrievedAt: '2026-11-17T00:00:00Z',
  effectiveYear: 2028,
  workbookSha256: 'a'.repeat(64)
};
const csv = (...rows: string[]) => [MAPPING_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';
// programme,section,category,kind,workbook_name,credits,track,source_row,course_code,minimum_grade,notes
const complete = csv(
  'CS,CORE,Humanities,COURSE,Written and Oral Comm.,1,both,7,WRIT 111,,',
  'CS,CORE,Humanities,COURSE,Leadership 1*,0.5,both,9,LEAD 111,,',
  'CS,CORE,Mathematics,ALTERNATIVE,Pre-Calculus 1,1,alternate (Pre-Calc),20,MATH 121,,',
  'CS,CORE,Mathematics,ALTERNATIVE,Calculus 1,1,standard,20,MATH 141,,',
  'CS,CORE,Mathematics,ALTERNATE_TRACK_ONLY,Applied Calc (Pre-Calc track only),1,alternate (Pre-Calc),22,MATH 125,,',
  'CS,CORE,Non-Major Electives,ELECTIVE_SLOTS,2 Non-Major Electives (at least 1 African studies),2,both,35,AS 101*; AS 102*; econ210,,',
  'CS,MAJOR,Capstone,CONDITIONAL_CAPSTONE,Capstone 1 (could be CS elective),1,both,60,cs400,C,',
  'CS,MAJOR,Major Electives,ELECTIVE_SLOTS,2 CS Electives,2,both,57,CS 351; CS 352; CS 361,,',
  'LLB,IAP,IAP,COURSE,Legal Reasoning,0,both,74,,,',
  'LLB,MAJOR,Required Major Classes,COURSE,Torts,1,both,40,LAW 210,,'
);

describe('building curriculum drafts from the completed mapping', () => {
  it('builds one valid draft per programme and track, from the components', () => {
    const { drafts, issues } = buildCurriculumDrafts(complete, options);
    expect(issues).toEqual([]);
    expect(drafts.map(d => [d.programme, d.track, d.draft.rules.totalCredits])).toEqual([
      ['CS', 'standard', 7.5],
      ['CS', 'pre-calculus', 8.5],
      ['LLB', 'standard', 1]
    ]);
    const standard = drafts[0].draft;
    expect(standard.rules.requiredCourses.map(c => [c.courseCode, c.credits, c.minimumGrade])).toEqual([
      ['WRIT 111', 1, 'D+'], ['LEAD 111', 0.5, 'D+'], ['MATH 141', 1, 'D+'], ['CS 400', 1, 'C']
    ]);
    expect(drafts[1].draft.rules.requiredCourses.map(c => c.courseCode)).toEqual(['WRIT 111', 'LEAD 111', 'MATH 121', 'MATH 125', 'CS 400']);
    expect(standard.rules.electivePools[0]).toEqual({
      category: 'Non-Major Electives', creditsRequired: 2, courseCodes: ['AS 101', 'AS 102', 'ECON 210'],
      africanStudiesMinimum: 1, africanStudiesCodes: ['AS 101', 'AS 102']
    });
    expect(standard).toMatchObject({ status: 'DRAFT', version: '2028-v1', sourceWorkbookHash: 'a'.repeat(64), rules: { verifiedByRegistry: false } });
    expect(validateCurriculum(standard as never).valid).toBe(true);
  });

  it('lists zero-credit courses instead of counting them', () => {
    const llb = buildCurriculumDrafts(complete, options).drafts.find(d => d.programme === 'LLB')!;
    expect(llb.zeroCreditCourses).toEqual(['Legal Reasoning']);
    expect(llb.draft.rules.requiredCourses.map(c => c.courseCode)).toEqual(['LAW 210']);
  });

  it('reports every problem by row and builds nothing for that programme', () => {
    const { drafts, issues } = buildCurriculumDrafts(csv(
      'CS,CORE,Humanities,COURSE,Written and Oral Comm.,1,both,7,,,',
      'CS,CORE,Mathematics,ALTERNATIVE,Pre-Calculus 1,1,confirm,20,MATH 121,,',
      'CS,CORE,Humanities,COURSE,Text and Meaning,1,both,8,ENGL 112,B,',
      'CS,MAJOR,Major Electives,ELECTIVE_SLOTS,2 CS Electives,2,both,57,,,',
      'CS,MAJOR,Major Electives,ELECTIVE_SLOTS,2 CS Electives,2,both,58,CS 351; Data Mining,,',
      'BA,CORE,Humanities,COURSE,Written and Oral Comm.,1,both,7,WRIT 111,,'
    ), options);
    expect(issues.map(issue => [issue.row, issue.message])).toEqual([
      [2, 'Add the course code for "Written and Oral Comm.".'],
      [3, 'Set track to "standard" or the alternate track shown for this programme (was "confirm").'],
      [4, 'minimum_grade must be blank (D+), D+ or C, not "B".'],
      [5, 'List the courses allowed for "2 CS Electives" in course_code, separated by semicolons.'],
      [6, '"DATA MINING" is not a course code like CS 351.']
    ]);
    expect(drafts.map(d => d.programme)).toEqual(['BA']);
  });

  it('passes on the draft validator findings, such as a course in two places', () => {
    const { drafts, issues } = buildCurriculumDrafts(csv(
      'CS,CORE,Humanities,COURSE,Written and Oral Comm.,1,both,7,WRIT 111,,',
      'CS,MAJOR,Major Electives,ELECTIVE_SLOTS,2 CS Electives,2,both,57,WRIT 111; CS 352,,'
    ), options);
    expect(drafts).toEqual([]);
    expect(issues).toEqual([{ row: 0, programme: 'CS', message: 'standard track draft is invalid: REQUIRED_COURSE_IN_ELECTIVE_POOL' }]);
  });

  it('refuses a file with the wrong columns, and an unfilled template', () => {
    expect(buildCurriculumDrafts('programme,code\r\nCS,CS 212\r\n', options).issues[0]).toMatchObject({ row: 1 });
    const sheet = [
      { sourceRow: 1, cells: [null, null, 'Computer Science', 'Completed?'] },
      { sourceRow: 2, cells: ['MAJOR', 'Required Major Classes', 'Data Structures'] },
      { sourceRow: 3, cells: [null, null, '1 Ashesi Credit'] }
    ];
    const template = mappingTemplateCsv([{ programme: 'CS', reconciliation: reconcileProgramme(sheet) }]);
    const result = buildCurriculumDrafts(template, options);
    expect(result.drafts).toEqual([]);
    expect(result.issues).toEqual([{ row: 2, programme: 'CS', message: 'Add the course code for "Data Structures".' }]);
  });
});

describe('African Studies lists in drafts', () => {
  const base = { version: 'v', status: 'DRAFT' as const, sources: [{ sourceUrl: options.sourceUrl, sourceKind: 'REGISTRY_PROVIDED_WORKBOOK' as const, retrievedAt: options.retrievedAt, effectiveYear: 2028, contentHash: 'h' }] };
  const withPool = (pool: object) => validateCurriculum({ ...base, rules: {
    programme: 'CS', track: 'standard', totalCredits: 3, verifiedByRegistry: false,
    requiredCourses: [{ courseCode: 'CS 111', credits: 1, minimumGrade: 'D+', category: 'Core' }],
    electivePools: [{ category: 'Non-Major Electives', creditsRequired: 2, courseCodes: ['AS 101', 'ECON 210'], ...pool }]
  } });

  it('must name courses from the pool, and enough of them', () => {
    expect(withPool({ africanStudiesMinimum: 1, africanStudiesCodes: ['AS 101'] }).valid).toBe(true);
    expect(withPool({ africanStudiesMinimum: 1, africanStudiesCodes: ['AS 999'] }).issues).toContain('AFRICAN_STUDIES_COURSE_NOT_IN_POOL');
    expect(withPool({ africanStudiesMinimum: 2, africanStudiesCodes: ['AS 101'] }).issues).toContain('NOT_ENOUGH_AFRICAN_STUDIES_OPTIONS');
  });
});
