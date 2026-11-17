import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ADMIN_PASSWORD, buildTestApp } from '../testing/fixtures.js';

async function adminToken(app: Awaited<ReturnType<typeof buildTestApp>>['app']) {
  return (await request(app).post('/api/v1/auth/login').send({ identifier: 'STF-1001', password: ADMIN_PASSWORD })).body.accessToken as string;
}

describe('student register API', () => {
  it('returns paged rows with factual flags, undetermined standing for real students, and logs the view', async () => {
    const { app, store } = await buildTestApp();
    store.courses.set('20260002', [{ courseCode: 'BUSA 101', attempts: [{ credits: 1, grade: 'E', status: 'COMPLETED' }] }]);
    const token = await adminToken(app);
    const response = await request(app).get('/api/v1/admin/register').query({ sort: 'passedCredits', order: 'desc' }).auth(token, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 2, page: 1, pageCount: 1, counts: { students: 2, UNRESOLVED_FAILURE: 1 } });
    expect(response.body.rows[0]).toMatchObject({ studentId: '20260001', passedCredits: 1, standing: 'UNDETERMINED', flags: [] });
    expect(response.body.rows[1]).toMatchObject({ studentId: '20260002', unresolvedFailures: 1, flags: ['UNRESOLVED_FAILURE'] });
    expect(store.auditLog.some(entry => entry.action === 'ADMIN_REGISTER_VIEWED' && entry.actorId === 'u-admin-1')).toBe(true);
  });

  it('filters by programme, year group and flag', async () => {
    const { app } = await buildTestApp();
    const token = await adminToken(app);
    const byProgramme = await request(app).get('/api/v1/admin/register').query({ programme: 'BA' }).auth(token, { type: 'bearer' });
    expect(byProgramme.body.rows.map((row: { studentId: string }) => row.studentId)).toEqual(['20260002']);
    const byYear = await request(app).get('/api/v1/admin/register').query({ yearGroup: 2030 }).auth(token, { type: 'bearer' });
    expect(byYear.body.total).toBe(0);
    const byFlag = await request(app).get('/api/v1/admin/register').query({ flag: 'INCOMPLETE' }).auth(token, { type: 'bearer' });
    expect(byFlag.body.total).toBe(0);
  });

  it('shows an advisory standing for synthetic students and filters by it', async () => {
    const { app, store } = await buildTestApp();
    Object.assign(store.students[0], { synthetic: true });
    const token = await adminToken(app);
    const all = await request(app).get('/api/v1/admin/register').auth(token, { type: 'bearer' });
    const synthetic = all.body.rows.find((row: { studentId: string }) => row.studentId === '20260001');
    expect(['RED', 'YELLOW', 'GREEN']).toContain(synthetic.standing);
    expect(all.body.rows.find((row: { studentId: string }) => row.studentId === '20260002').standing).toBe('UNDETERMINED');
    const filtered = await request(app).get('/api/v1/admin/register').query({ standing: synthetic.standing }).auth(token, { type: 'bearer' });
    expect(filtered.body.rows.map((row: { studentId: string }) => row.studentId)).toEqual(['20260001']);
  });

  it('rejects unknown filters and sorts', async () => {
    const { app } = await buildTestApp();
    const token = await adminToken(app);
    for (const query of [{ sort: 'passwordHash' }, { flag: 'ELIGIBLE' }, { standing: 'PURPLE' }, { programme: 'cs; drop' }, { pageSize: 5000 }]) {
      expect((await request(app).get('/api/v1/admin/register').query(query).auth(token, { type: 'bearer' })).status).toBe(400);
    }
  });

  it('exports the filtered register as CSV and logs the export', async () => {
    const { app, store } = await buildTestApp();
    const token = await adminToken(app);
    const response = await request(app).get('/api/v1/admin/register.csv').query({ programme: 'CS' }).auth(token, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain('student-register.csv');
    const lines = response.text.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1].startsWith('20260001,Synthetic Student One,CS,2028')).toBe(true);
    expect(store.auditLog.find(entry => entry.action === 'ADMIN_REGISTER_EXPORTED')?.metadata).toMatchObject({ programme: 'CS', rows: 1 });
  });
});
