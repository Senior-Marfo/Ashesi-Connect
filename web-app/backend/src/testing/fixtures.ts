import { hashPassword } from '../auth/passwords.js';
import { loadConfig, type AppConfig } from '../config.js';
import { createApp } from '../http/app.js';
import { createMemoryRepositories } from './memory-repositories.js';

export const STUDENT_PASSWORD = 'Correct-Horse-42';
export const ADMIN_PASSWORD = 'Registry-Desk-77';

export function testConfig(overrides: NodeJS.ProcessEnv = {}): AppConfig {
  return loadConfig({ NODE_ENV: 'test', JWT_ACCESS_SECRET: 'test-secret-that-is-at-least-32-characters', CORS_ORIGINS: 'http://localhost:3000', ...overrides });
}

export async function buildTestApp(overrides: NodeJS.ProcessEnv = {}) {
  const { repositories, store } = createMemoryRepositories();
  const [studentHash, adminHash] = await Promise.all([hashPassword(STUDENT_PASSWORD), hashPassword(ADMIN_PASSWORD)]);
  store.users.push(
    { id: 'u-student-1', identifier: '20260001', passwordHash: studentHash, role: 'STUDENT', studentId: '20260001', forcePasswordChange: false, failedLogins: 0 },
    { id: 'u-student-2', identifier: '20260002', passwordHash: studentHash, role: 'STUDENT', studentId: '20260002', forcePasswordChange: false, failedLogins: 0 },
    { id: 'u-admin-1', identifier: 'STF-1001', passwordHash: adminHash, role: 'ADMIN', forcePasswordChange: false, failedLogins: 0 }
  );
  store.students.push(
    { studentId: '20260001', fullName: 'Synthetic Student One', programme: 'CS', yearGroup: 2028, track: 'standard' },
    { studentId: '20260002', fullName: 'Synthetic Student Two', programme: 'BA', yearGroup: 2028, track: 'standard' }
  );
  store.courses.set('20260001', [{ courseCode: 'CS 111', attempts: [{ credits: 1, grade: 'B+', status: 'COMPLETED', semester: '2024-FALL' }] }]);
  store.courses.set('20260002', [{ courseCode: 'BUSA 101', attempts: [{ credits: 1, grade: 'A', status: 'COMPLETED', semester: '2024-FALL' }] }]);

  const config = testConfig(overrides);
  const app = createApp({ config, repositories, isHealthy: () => true, now: () => new Date('2026-11-17T00:00:00Z') });
  return { app, store, repositories, config };
}
