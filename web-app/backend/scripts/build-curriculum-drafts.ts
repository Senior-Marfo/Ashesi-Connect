/**
 * Builds curriculum drafts from the Registry-completed course mapping. Never writes to a database.
 *
 *   npx tsx scripts/build-curriculum-drafts.ts <mapping.csv> \
 *     --source-url https://… --workbook-sha256 <hex> --version 2028-v1 [--effective-year 2028] [--out drafts]
 *
 * Writes <PROGRAMME>-<track>.json for each draft and drafts-summary.md. Exits with status 1 if any
 * row has a problem; that programme then gets no draft. Import each draft to staging with
 * scripts/import-curriculum-draft.ts, then review it in the app.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCurriculumDrafts } from '../src/domain/eligibility/curriculum-mapping.js';

const [file, ...flags] = process.argv.slice(2);
const flag = (name: string) => {
  const index = flags.indexOf(`--${name}`);
  return index >= 0 ? flags[index + 1] : undefined;
};
const sourceUrl = flag('source-url');
const workbookSha256 = flag('workbook-sha256');
const version = flag('version');
if (!file || !sourceUrl || !workbookSha256 || !version) {
  throw Error('Usage: build-curriculum-drafts.ts <mapping.csv> --source-url <https url> --workbook-sha256 <hex> --version <label> [--effective-year 2028] [--out <dir>]');
}
const outDir = flag('out') ?? 'curriculum-drafts';
const { drafts, issues } = buildCurriculumDrafts(readFileSync(file, 'utf8'), {
  version,
  sourceUrl,
  workbookSha256,
  effectiveYear: Number(flag('effective-year') ?? 2028),
  retrievedAt: new Date().toISOString()
});

mkdirSync(outDir, { recursive: true });
for (const built of drafts) writeFileSync(join(outDir, `${built.programme}-${built.track}.json`), JSON.stringify(built.draft, null, 2));
const summary = [
  `# Curriculum drafts: ${version}`,
  '',
  `${drafts.length} draft(s) built, ${issues.length} problem(s). Every draft has status DRAFT; none is used for assessments until it is imported to staging and reviewed.`,
  '',
  '| Programme | Track | Required credits | Elective credits | Total | Not counted (0 credits) |',
  '|---|---|---|---|---|---|',
  ...drafts.map(d => `| ${d.programme} | ${d.track} | ${d.requiredCredits} | ${d.electiveCredits} | ${d.draft.rules.totalCredits} | ${d.zeroCreditCourses.join(', ') || '—'} |`),
  ...(issues.length ? ['', '## Problems to fix in the mapping', '', '| Row | Programme | Problem |', '|---|---|---|', ...issues.map(i => `| ${i.row || '—'} | ${i.programme || '—'} | ${i.message.replaceAll('|', '\\|')} |`)] : []),
  ''
].join('\n');
writeFileSync(join(outDir, 'drafts-summary.md'), summary);
console.log(`${drafts.length} draft(s) and ${issues.length} problem(s); see ${join(outDir, 'drafts-summary.md')}.`);
if (issues.length) process.exitCode = 1;
