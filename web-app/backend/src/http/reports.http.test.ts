import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { generateSyntheticDataset } from '../seed/synthetic-data.js';
import { ADMIN_PASSWORD, buildTestApp } from '../testing/fixtures.js';

async function withSyntheticCohorts() {
  const built = await buildTestApp();
  const dataset = generateSyntheticDataset({ count: 60, today: new Date('2026-11-17T00:00:00Z') });
  built.store.students.push(...dataset.students);
  for (const e of dataset.enrollments) built.store.courses.set(e.studentId, [...(built.store.courses.get(e.studentId) ?? []), { courseCode: e.courseCode, attempts: e.attempts }]);
  const token = (await request(built.app).post('/api/v1/auth/login').send({ identifier: 'STF-1001', password: ADMIN_PASSWORD })).body.accessToken as string;
  return { ...built, token };
}

describe('reports API', () => {
  it('reports projections, credits remaining and messaging reach', async () => {
    const { app, token, store } = await withSyntheticCohorts();
    store.messages.push({ id: 'm1', title: 'Sent', body: 'b', priority: 'NORMAL', audience: { kind: 'ALL_STUDENTS' }, senderId: 'u-admin-1', sentAt: new Date('2026-11-10T00:00:00Z'), recipientCount: 4 });
    store.messages.push({ id: 'm2', title: 'Scheduled', body: 'b', priority: 'NORMAL', audience: { kind: 'ALL_STUDENTS' }, senderId: 'u-admin-1', sentAt: new Date('2026-12-01T00:00:00Z'), recipientCount: 9 });
    store.receipts.push(
      ...['a', 'b', 'c', 'd'].map((studentId, index) => ({ messageId: 'm1', studentId, deliveredAt: new Date('2026-11-10T00:00:00Z'), readAt: index === 0 ? new Date('2026-11-11T00:00:00Z') : undefined }))
    );
    const body = (await request(app).get('/api/v1/admin/reports').auth(token, { type: 'bearer' })).body;
    expect(body.messaging).toEqual({ messages: 1, recipients: 4, read: 1, readRate: 25 });
    const current = body.cohortProgress.reduce((sum: number, cohort: { assessed: number }) => sum + cohort.assessed, 0);
    expect(Object.values(body.creditsRemaining as Record<string, number>).reduce((a, b) => a + b, 0)).toBe(current);
    expect(body.projections.map((p: { yearGroup: number }) => p.yearGroup)).toEqual(body.cohortProgress.map((c: { yearGroup: number }) => c.yearGroup));
    for (const projection of body.projections) expect(projection.term).toMatch(/^\d{4} (Spring|Fall)$/);
  });

  it('returns every report section and records the view', async () => {
    const { app, token, store } = await withSyntheticCohorts();
    const response = await request(app).get('/api/v1/admin/reports').auth(token, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.totals).toMatchObject({ students: 62, graduatedCohorts: [2025, 2026] });
    expect(response.body.cohortOutcomes.map((c: { yearGroup: number }) => c.yearGroup)).toEqual([2025, 2026]);
    expect(response.body.cohortOutcomes[0].completionRate).toBeGreaterThan(50);
    expect(response.body.cohortProgress.map((c: { yearGroup: number }) => c.yearGroup)).toEqual([2027, 2028, 2029, 2030]);
    expect(response.body.programmes).toHaveLength(10);
    expect(response.body.courses.length).toBeGreaterThan(50);
    expect(response.body.standings.UNDETERMINED).toBe(2);
    expect(store.auditLog.some(entry => entry.action === 'ADMIN_REPORTS_VIEWED')).toBe(true);
  });

  it('applies programme and year-group filters', async () => {
    const { app, token } = await withSyntheticCohorts();
    const response = await request(app).get('/api/v1/admin/reports').query({ programme: 'CS', yearGroup: 2025 }).auth(token, { type: 'bearer' });
    expect(response.body.totals.students).toBe(1);
    expect(response.body.programmes.map((p: { programme: string }) => p.programme)).toEqual(['CS']);
    expect((await request(app).get('/api/v1/admin/reports').query({ yearGroup: 'soon' }).auth(token, { type: 'bearer' })).status).toBe(400);
  });

  it.each(['cohorts', 'programmes', 'courses'])('exports the %s section as CSV', async section => {
    const { app, token } = await withSyntheticCohorts();
    const response = await request(app).get(`/api/v1/admin/reports/${section}.csv`).auth(token, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toContain(`report-${section}.csv`);
    expect(response.text.replace(/^﻿/, '').split('\r\n').length).toBeGreaterThan(2);
  });

  it('rejects unknown sections', async () => {
    const { app, token } = await withSyntheticCohorts();
    expect((await request(app).get('/api/v1/admin/reports/salaries.csv').auth(token, { type: 'bearer' })).status).toBe(404);
  });
});
