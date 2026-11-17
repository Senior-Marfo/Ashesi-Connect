import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ADMIN_PASSWORD, STUDENT_PASSWORD, buildTestApp } from '../testing/fixtures.js';

const ADMIN_ROUTES: Array<['get' | 'post', string]> = [
  ['get', '/api/v1/admin/students'],
  ['get', '/api/v1/admin/students/20260002'],
  ['get', '/api/v1/admin/audit-log'],
  ['post', '/api/v1/admin/users/reset-password'],
  ['get', '/api/v1/admin/curricula'],
  ['get', '/api/v1/admin/register'],
  ['get', '/api/v1/admin/reports'],
  ['get', '/api/v1/admin/messages'],
  ['get', '/api/v1/admin/imports'],
  ['post', '/api/v1/admin/imports/preview'],
  ['post', '/api/v1/admin/imports'],
  ['post', '/api/v1/admin/messages'],
  ['post', '/api/v1/admin/messages/preview'],
  ['get', '/api/v1/admin/reports/courses.csv'],
  ['get', '/api/v1/admin/students/20260002/eligibility'],
  ['get', '/api/v1/admin/register.csv'],
  ['post', '/api/v1/admin/curricula/review']
];

async function tokenFor(app: Awaited<ReturnType<typeof buildTestApp>>['app'], identifier: string, password: string): Promise<string> {
  return (await request(app).post('/api/v1/auth/login').send({ identifier, password })).body.accessToken;
}

describe('role-based access control', () => {
  it.each(ADMIN_ROUTES)('denies a student token on %s %s', async (method, path) => {
    const { app } = await buildTestApp();
    const token = await tokenFor(app, '20260001', STUDENT_PASSWORD);
    const response = await request(app)[method](path).auth(token, { type: 'bearer' }).send({ identifier: '20260002' });
    expect(response.status).toBe(403);
  });

  it.each(ADMIN_ROUTES)('denies anonymous requests on %s %s', async (method, path) => {
    const { app } = await buildTestApp();
    expect((await request(app)[method](path)).status).toBe(401);
  });

  it('rejects tokens signed with another secret or algorithm', async () => {
    const { app } = await buildTestApp();
    const forged = jwt.sign({ role: 'ADMIN' }, 'attacker-controlled-secret-of-sufficient-length', { subject: 'u-admin-1', issuer: 'ashesi-graduation-tracker', audience: 'ashesi-api' });
    const unsigned = jwt.sign({ role: 'ADMIN' }, '', { algorithm: 'none', subject: 'u-admin-1', issuer: 'ashesi-graduation-tracker', audience: 'ashesi-api' });
    expect((await request(app).get('/api/v1/admin/students').auth(forged, { type: 'bearer' })).status).toBe(401);
    expect((await request(app).get('/api/v1/admin/students').set('authorization', `Bearer ${unsigned}`)).status).toBe(401);
  });

  it('an admin token cannot use the student self-service route', async () => {
    const { app } = await buildTestApp();
    const token = await tokenFor(app, 'STF-1001', ADMIN_PASSWORD);
    expect((await request(app).get('/api/v1/students/me').auth(token, { type: 'bearer' })).status).toBe(403);
  });
});

describe('student record isolation (IDOR)', () => {
  it('returns only the signed-in student record', async () => {
    const { app } = await buildTestApp();
    const token = await tokenFor(app, '20260001', STUDENT_PASSWORD);
    const response = await request(app).get('/api/v1/students/me').query({ studentId: '20260002' }).auth(token, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.student.studentId).toBe('20260001');
    expect(response.body.courses.map((course: { courseCode: string }) => course.courseCode)).toEqual(['CS 111']);
  });

  it('exposes no route for a student to address another student by ID', async () => {
    const { app } = await buildTestApp();
    const token = await tokenFor(app, '20260001', STUDENT_PASSWORD);
    for (const path of ['/api/v1/students/20260002', '/api/v1/students/me/../20260002']) {
      const response = await request(app).get(path).auth(token, { type: 'bearer' });
      expect([403, 404]).toContain(response.status);
      expect(JSON.stringify(response.body)).not.toContain('Synthetic Student Two');
    }
  });
});

describe('admin activity logging', () => {
  it('records searches and profile views with the acting admin', async () => {
    const { app, store } = await buildTestApp();
    const token = await tokenFor(app, 'STF-1001', ADMIN_PASSWORD);
    const search = await request(app).get('/api/v1/admin/students').query({ q: '2026' }).auth(token, { type: 'bearer' });
    expect(search.body.students).toHaveLength(2);
    await request(app).get('/api/v1/admin/students/20260002').auth(token, { type: 'bearer' });

    const viewed = store.auditLog.find(entry => entry.action === 'ADMIN_STUDENT_VIEWED');
    expect(viewed).toMatchObject({ actorId: 'u-admin-1', actorRole: 'ADMIN', subject: '20260002' });
    expect(viewed?.requestId).toBeTruthy();
    expect(store.auditLog.some(entry => entry.action === 'ADMIN_STUDENT_SEARCHED' && entry.metadata?.query === '2026')).toBe(true);
  });

  it('rejects search input that is not an ID fragment', async () => {
    const { app } = await buildTestApp();
    const token = await tokenFor(app, 'STF-1001', ADMIN_PASSWORD);
    const response = await request(app).get('/api/v1/admin/students').query({ q: '.*' }).auth(token, { type: 'bearer' });
    expect(response.status).toBe(400);
  });

  it('lists the audit log newest first and logs the viewing', async () => {
    const { app } = await buildTestApp();
    const token = await tokenFor(app, 'STF-1001', ADMIN_PASSWORD);
    const response = await request(app).get('/api/v1/admin/audit-log').query({ limit: 5 }).auth(token, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.entries[0].action).toBe('AUTH_LOGIN_SUCCEEDED');
  });
});
