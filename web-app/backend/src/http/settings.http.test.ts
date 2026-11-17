import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { generateSyntheticDataset } from '../seed/synthetic-data.js';
import { ADMIN_PASSWORD, buildTestApp } from '../testing/fixtures.js';

async function setup() {
  const built = await buildTestApp();
  const token = (await request(built.app).post('/api/v1/auth/login').send({ identifier: 'STF-1001', password: ADMIN_PASSWORD })).body.accessToken as string;
  return { ...built, token };
}

describe('settings', () => {
  it('starts from the documented standing defaults', async () => {
    const { app, token } = await setup();
    expect((await request(app).get('/api/v1/admin/settings').auth(token, { type: 'bearer' })).body.standing).toEqual({ normalLoad: 5, maxLoad: 6, criticalFailedCourses: 3 });
  });

  it('validates, saves and audits threshold changes, and every standing uses them', async () => {
    const { app, token, store } = await setup();
    const dataset = generateSyntheticDataset({ count: 30, today: new Date('2026-11-17T00:00:00Z') });
    store.students.push(...dataset.students);
    for (const e of dataset.enrollments) store.courses.set(e.studentId, [...(store.courses.get(e.studentId) ?? []), { courseCode: e.courseCode, attempts: e.attempts }]);
    const countRed = async () => (await request(app).get('/api/v1/admin/register').auth(token, { type: 'bearer' })).body.counts.RED as number;
    const before = await countRed();

    for (const body of [{ normalLoad: 6, maxLoad: 5, criticalFailedCourses: 3 }, { normalLoad: 0, maxLoad: 5, criticalFailedCourses: 3 }, { normalLoad: 4.3, maxLoad: 5, criticalFailedCourses: 3 }]) {
      expect((await request(app).put('/api/v1/admin/settings/standing').auth(token, { type: 'bearer' }).send(body)).status).toBe(400);
    }
    const saved = await request(app).put('/api/v1/admin/settings/standing').auth(token, { type: 'bearer' }).send({ normalLoad: 2, maxLoad: 2.5, criticalFailedCourses: 1 });
    expect(saved.body).toMatchObject({ standing: { normalLoad: 2, maxLoad: 2.5, criticalFailedCourses: 1 }, updatedBy: 'u-admin-1' });
    expect(store.auditLog.find(e => e.action === 'ADMIN_SETTINGS_UPDATED')?.metadata).toMatchObject({ normalLoad: 2, 'previous.normalLoad': 5 });
    expect(await countRed()).toBeGreaterThan(before);
  });

  it('lists admins and creates new ones with a one-time temporary password they must change', async () => {
    const { app, token, store } = await setup();
    expect((await request(app).get('/api/v1/admin/settings/admins').auth(token, { type: 'bearer' })).body.admins.map((a: { identifier: string }) => a.identifier)).toEqual(['STF-1001']);

    const created = await request(app).post('/api/v1/admin/settings/admins').auth(token, { type: 'bearer' }).send({ identifier: 'STF-2002' });
    expect(created.status).toBe(201);
    expect(created.headers['cache-control']).toBe('no-store');
    const login = await request(app).post('/api/v1/auth/login').send({ identifier: 'STF-2002', password: created.body.temporaryPassword });
    expect(login.body).toMatchObject({ role: 'ADMIN', passwordChangeRequired: true });
    expect(store.auditLog.some(e => e.action === 'ADMIN_USER_CREATED' && e.subject === 'STF-2002')).toBe(true);

    expect((await request(app).post('/api/v1/admin/settings/admins').auth(token, { type: 'bearer' }).send({ identifier: 'STF-2002' })).status).toBe(409);
    expect((await request(app).post('/api/v1/admin/settings/admins').auth(token, { type: 'bearer' }).send({ identifier: '20260001' })).body.error).toBe('INVALID_STAFF_ID');
  });
});
