/**
 * Loads or removes SYNTHETIC student records (fictional people, illustrative courses).
 *
 *   MODE=dry-run (default)  prints what would be written; never connects
 *   MODE=seed               writes; needs SEED_CONFIRM=SYNTHETIC_RECORDS_ONLY and SYNTHETIC_STUDENT_PASSWORD
 *   MODE=remove             deletes every synthetic record; needs SEED_CONFIRM=SYNTHETIC_RECORDS_ONLY
 *
 * Optional: SYNTHETIC_COUNT (default 600). Refuses to seed a database holding real students.
 * Never prints the connection string or passwords.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { hashPassword, passwordPolicyViolation } from '../src/auth/passwords.js';
import { removeSyntheticRecords, seedSyntheticRecords } from '../src/seed/apply.js';
import { generateSyntheticDataset } from '../src/seed/synthetic-data.js';

const mode = process.env.MODE ?? 'dry-run';
if (!['dry-run', 'seed', 'remove'].includes(mode)) throw new Error('MODE must be dry-run, seed or remove');
const count = Number(process.env.SYNTHETIC_COUNT ?? 600);
if (!Number.isInteger(count) || count < 1 || count > 5000) throw new Error('SYNTHETIC_COUNT must be between 1 and 5000');

const dataset = generateSyntheticDataset({ count });
const perYear = new Map<number, number>();
for (const student of dataset.students) perYear.set(student.yearGroup, (perYear.get(student.yearGroup) ?? 0) + 1);
const byYear = [...perYear].map(([year, total]) => `${year}: ${total}`);
console.log(`Synthetic dataset: ${dataset.students.length} students, ${dataset.enrollments.length} course records (${byYear.join(', ')})`);

if (mode === 'dry-run') {
  console.log('Dry run: no database connection was made and nothing was written.');
  process.exit(0);
}
if (process.env.SEED_CONFIRM !== 'SYNTHETIC_RECORDS_ONLY') throw new Error('Set SEED_CONFIRM=SYNTHETIC_RECORDS_ONLY to write');
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');

let passwordHash = '';
if (mode === 'seed') {
  const password = process.env.SYNTHETIC_STUDENT_PASSWORD ?? '';
  const violation = passwordPolicyViolation(password, '00000000');
  if (violation) throw new Error(`SYNTHETIC_STUDENT_PASSWORD rejected: ${violation}`);
  passwordHash = await hashPassword(password);
}

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15_000 });
try {
  const result = mode === 'seed' ? await seedSyntheticRecords(dataset, passwordHash) : await removeSyntheticRecords();
  console.log(`${mode === 'seed' ? 'Seeded' : 'Removed'}:`, JSON.stringify(result));
} finally {
  await mongoose.disconnect();
}
