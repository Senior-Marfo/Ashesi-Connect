import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { ADMIN_PASSWORD, STUDENT_PASSWORD, buildTestApp } from '../testing/fixtures.js';

type App = Awaited<ReturnType<typeof buildTestApp>>['app'];
const REVIEW_BODY = { programme: 'CS', track: 'standard', version: '2028-v1', evidenceReference: 'test-evidence' };

async function tokenFor(app: App, identifier: string, password: string): Promise<string> {
  return (await request(app).post('/api/v1/auth/login').send({ identifier, password })).body.accessToken;
}

afterEach(() => {
  delete process.env.ENABLE_CURRICULUM_REVIEW;
  delete process.env.CURRICULUM_REVIEWER_IDS;
});

// None of these requests may reach the database: every gate must fail before any query runs.
describe('curriculum HTTP authorization gates', () => {
  it('rejects unauthenticated review requests', async () => {
    const { app } = await buildTestApp();
    const response = await request(app).post('/api/v1/admin/curricula/review').send(REVIEW_BODY);
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('UNAUTHORIZED');
  });

  it('rejects student tokens on review', async () => {
    const { app } = await buildTestApp();
    const token = await tokenFor(app, '20260001', STUDENT_PASSWORD);
    const response = await request(app).post('/api/v1/admin/curricula/review').auth(token, { type: 'bearer' }).send(REVIEW_BODY);
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('FORBIDDEN');
  });

  it('rejects invalid bearer tokens', async () => {
    const { app } = await buildTestApp();
    const response = await request(app).post('/api/v1/admin/curricula/review').set('authorization', 'Bearer not-a-jwt').send(REVIEW_BODY);
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('UNAUTHORIZED');
  });

  it('denies unauthenticated and student catalogue reads', async () => {
    const { app } = await buildTestApp();
    expect((await request(app).get('/api/v1/admin/curricula')).status).toBe(401);
    const token = await tokenFor(app, '20260001', STUDENT_PASSWORD);
    expect((await request(app).get('/api/v1/admin/curricula').auth(token, { type: 'bearer' })).status).toBe(403);
  });

  it.each(['/api/v1/students/me/academic-preview', '/api/v1/students/me/curriculum', '/api/v1/students/me/audit-readiness'])(
    'denies admin access to the student-scoped %s',
    async path => {
      const { app } = await buildTestApp();
      const token = await tokenFor(app, 'STF-1001', ADMIN_PASSWORD);
      expect((await request(app).get(path).auth(token, { type: 'bearer' })).status).toBe(403);
    }
  );

  it('blocks a temporary-password session from the academic preview', async () => {
    const { app, store } = await buildTestApp();
    store.users[0].forcePasswordChange = true;
    const token = await tokenFor(app, '20260001', STUDENT_PASSWORD);
    const response = await request(app).get('/api/v1/students/me/academic-preview').auth(token, { type: 'bearer' });
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('returns a disabled response to admins by default', async () => {
    const { app } = await buildTestApp();
    const token = await tokenFor(app, 'STF-1001', ADMIN_PASSWORD);
    const response = await request(app).post('/api/v1/admin/curricula/review').auth(token, { type: 'bearer' }).send(REVIEW_BODY);
    expect(response.status).toBe(503);
    expect(response.body.error).toBe('CURRICULUM_REVIEW_DISABLED');
  });

  it('denies an admin who is not explicitly allowlisted', async () => {
    const { app } = await buildTestApp();
    process.env.ENABLE_CURRICULUM_REVIEW = 'yes';
    process.env.CURRICULUM_REVIEWER_IDS = 'someone-else';
    const token = await tokenFor(app, 'STF-1001', ADMIN_PASSWORD);
    const response = await request(app).post('/api/v1/admin/curricula/review').auth(token, { type: 'bearer' }).send(REVIEW_BODY);
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('REVIEWER_NOT_AUTHORIZED');
  });
});
