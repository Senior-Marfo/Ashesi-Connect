/**
 * Local demo API backed by in-memory synthetic records. Nothing is persisted and
 * no real student data is involved. Refuses to start in production.
 */
import mongoose from 'mongoose';
import { hashPassword } from '../auth/passwords.js';
import { loadConfig } from '../config.js';
import { createApp } from '../http/app.js';
import { createMemoryRepositories } from './memory-repositories.js';

export const DEMO_PASSWORD = 'Synthetic-Demo-2028';

export async function createDemoApp(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === 'production') throw new Error('The in-memory demo server must not run in production');
  const config = loadConfig({
    JWT_ACCESS_SECRET: 'local-demo-secret-not-for-deployment-0000',
    CORS_ORIGINS: 'http://localhost:3000',
    ...env,
    NODE_ENV: 'development'
  });
  // No database here: curriculum routes query MongoDB directly, so make them fail fast (503) instead of waiting on a connection.
  mongoose.set('bufferCommands', false);
  const { repositories, store } = createMemoryRepositories();
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const account = (id: string, identifier: string, role: 'STUDENT' | 'ADMIN', forcePasswordChange = false) =>
    ({ id, identifier, passwordHash, role, studentId: role === 'STUDENT' ? identifier : undefined, forcePasswordChange, failedLogins: 0 });

  store.users.push(
    account('demo-student-1', '20280001', 'STUDENT'),
    account('demo-student-2', '20280002', 'STUDENT'),
    account('demo-student-3', '20280003', 'STUDENT', true),
    account('demo-admin-1', 'STF-1001', 'ADMIN')
  );
  store.students.push(
    { studentId: '20280001', fullName: 'Ama Synthetic Mensah', programme: 'CS', yearGroup: 2028, track: 'standard', synthetic: true },
    { studentId: '20280002', fullName: 'Kofi Synthetic Boateng', programme: 'BA', yearGroup: 2028, track: 'pre-calculus', synthetic: true },
    { studentId: '20280003', fullName: 'Esi Synthetic Owusu', programme: 'ME', yearGroup: 2029, track: 'calculus-1-2', synthetic: true }
  );
  store.courses.set('20280001', [
    { courseCode: 'CS 111', attempts: [{ credits: 1, grade: 'B+', status: 'COMPLETED', semester: '2024 Fall' }] },
    { courseCode: 'MATH 141', attempts: [
      { credits: 1, grade: 'D', status: 'COMPLETED', semester: '2024 Fall' },
      { credits: 1, grade: 'B', status: 'COMPLETED', semester: '2025 Spring' }
    ] },
    { courseCode: 'CS 212', attempts: [{ credits: 1, grade: 'A', status: 'COMPLETED', semester: '2025 Spring' }] },
    { courseCode: 'SOAN 211', attempts: [{ credits: 0.5, grade: 'A+', status: 'COMPLETED', semester: '2025 Fall' }] },
    { courseCode: 'CS 415', attempts: [{ credits: 1, status: 'ENROLLED', semester: '2026 Fall' }] }
  ]);
  store.courses.set('20280002', [
    { courseCode: 'BUSA 101', attempts: [{ credits: 1, grade: 'C+', status: 'COMPLETED', semester: '2024 Fall' }] },
    { courseCode: 'ECON 101', attempts: [{ credits: 1, status: 'INCOMPLETE', semester: '2025 Spring' }] }
  ]);

  return { app: createApp({ config, repositories, isHealthy: () => true }), config };
}

async function main() {
  const { app, config } = await createDemoApp();
  app.listen(config.port, () => {
    console.log(`Demo API (synthetic, in-memory) on http://localhost:${config.port}`);
    console.log(`Accounts: 20280001, 20280002, 20280003 (must change password), STF-1001 — password ${DEMO_PASSWORD}`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
