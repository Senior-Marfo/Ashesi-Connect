/**
 * Workbook inspection, reconciliation and mapping template. Never writes to a database.
 *
 *   npx tsx scripts/ingest-degree-audit.ts /path/to/Degree_Audit_2028.xlsx [output-directory]
 *
 * Writes to the output directory (default: the current one):
 *   degree-audit-normalized-preview.json  every sheet's rows, extraction and reconciliation
 *   degree-audit-reconciliation.md        printed totals checked against their components
 *   curriculum-course-mapping.csv         one row per requirement line, for the Registry to add course codes
 */
import * as XLSX from 'xlsx';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { validateWorkbookRows } from '../src/domain/eligibility/workbook-preview.js';
import { extractProgramme } from '../src/domain/eligibility/workbook-extract.js';
import { reconcileProgramme } from '../src/domain/eligibility/workbook-reconcile.js';
import { mappingTemplateCsv, reconciliationReport } from '../src/domain/eligibility/workbook-report.js';

const [input, outputDir = '.'] = process.argv.slice(2);
if (!input) throw Error('Usage: ingest-degree-audit.ts <workbook.xlsx> [output-directory]');
const bytes = readFileSync(input);
// XLSX.readFile is unavailable under ES modules; parse the bytes instead.
const workbook = XLSX.read(bytes, { cellDates: false });
const programmes = ['BA', 'ECON', 'LLB', 'MIS', 'CS', 'CE', 'EE', 'ME', 'MT', 'BE'];
const allRows: Record<string, unknown[][]> = {};
const output = programmes.map(programme => {
  const sheet = workbook.Sheets[programme];
  if (!sheet) throw Error('Missing programme sheet: ' + programme);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  allRows[programme] = rows;
  const sourceRows = rows.map((cells, index) => ({ sourceRow: index + 1, cells })).filter(row => row.cells.some(cell => cell !== null && cell !== ''));
  return { programme, sourceSheet: programme, rows: sourceRows, extraction: extractProgramme(sourceRows), reconciliation: reconcileProgramme(sourceRows) };
});
const issues = validateWorkbookRows(allRows);
if (issues.length) throw Error('Workbook validation failed: ' + issues.join(', '));
const sourceSha256 = createHash('sha256').update(bytes).digest('hex');

mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'degree-audit-normalized-preview.json'), JSON.stringify({ schemaVersion: 2, sourceSha256, programmes: output, readyForCertification: false, mappingStatus: 'PENDING_RECONCILIATION' }, null, 2));
const reconciled = output.map(({ programme, reconciliation }) => ({ programme, reconciliation }));
writeFileSync(join(outputDir, 'degree-audit-reconciliation.md'), reconciliationReport(reconciled, sourceSha256));
writeFileSync(join(outputDir, 'curriculum-course-mapping.csv'), mappingTemplateCsv(reconciled));
const discrepancies = reconciled.reduce((sum, entry) => sum + entry.reconciliation.discrepancies.length, 0);
console.log(`Inspected ${output.length} programme sheets (sha256 ${sourceSha256}); ${discrepancies} discrepancies. Output needs Registry reconciliation before import.`);
