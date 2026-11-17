import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { syntheticProgrammeRules } from '../seed/synthetic-curriculum.js';
import { ADMIN_PASSWORD, buildTestApp } from '../testing/fixtures.js';

const course = syntheticProgrammeRules('CS', 'standard')!.requiredCourses[0].courseCode;

async function setup() {
  const built = await buildTestApp();
  built.store.students.push({ studentId: '20289999', fullName: 'Synthetic Pass Mark', programme: 'CS', yearGroup: 2028, track: 'standard', synthetic: true });
  built.store.courses.set('20289999', [{ courseCode: course, attempts: [{ credits: 1, grade: 'D+', status: 'COMPLETED', semester: '2024 Fall' }] }]);
  const token = (await request(built.app).post('/api/v1/auth/login').send({ identifier: 'STF-1001', password: ADMIN_PASSWORD })).body.accessToken as string;
  const as = <T extends request.Test>(test: T) => test.auth(token, { type: 'bearer' });
  return { ...built, as };
}

describe('course pass marks', () => {
  it('starts empty with a D+ default', async () => {
    const { app, as } = await setup();
    expect((await as(request(app).get('/api/v1/admin/settings/pass-marks'))).body).toEqual({ defaultMinimumGrade: 'D+', passMarks: [] });
  });

  it('a C pass mark turns a D+ into a failure in the audit, register and reports, and removing it restores D+', async () => {
    const { app, as, store } = await setup();
    const item = async () => (await as(request(app).get('/api/v1/admin/students/20289999/eligibility'))).body.requirements
      .flatMap((group: { items: Array<{ code: string }> }) => group.items).find((entry: { code: string }) => entry.code === course);
    const registerRow = async () => (await as(request(app).get('/api/v1/admin/register'))).body.rows.find((row: { studentId: string }) => row.studentId === '20289999');
    const reportCourse = async () => (await as(request(app).get('/api/v1/admin/reports'))).body.courses.find((entry: { courseCode: string }) => entry.courseCode === course);

    expect(await item()).toMatchObject({ state: 'COMPLETED', minimumGrade: 'D+' });
    expect(await registerRow()).toMatchObject({ unresolvedFailures: 0 });

    const saved = await as(request(app).put(`/api/v1/admin/settings/pass-marks/${encodeURIComponent(course.toLowerCase())}`)).send({ minimumGrade: 'C', note: '  Registry memo 2026-14 ' });
    expect(saved.body).toEqual({ courseCode: course, minimumGrade: 'C' });
    expect(await item()).toMatchObject({ state: 'FAILED', minimumGrade: 'C' });
    expect(await registerRow()).toMatchObject({ unresolvedFailures: 1 });
    expect(await reportCourse()).toMatchObject({ firstAttemptPassRate: 0, unresolvedFailures: 1 });

    const listed = (await as(request(app).get('/api/v1/admin/settings/pass-marks'))).body.passMarks;
    expect(listed).toEqual([{ courseCode: course, minimumGrade: 'C', note: 'Registry memo 2026-14', updatedBy: 'STF-1001', updatedAt: '2026-11-17T00:00:00.000Z' }]);

    expect((await as(request(app).delete(`/api/v1/admin/settings/pass-marks/${encodeURIComponent(course)}`))).status).toBe(204);
    expect(await item()).toMatchObject({ state: 'COMPLETED', minimumGrade: 'D+' });
    expect(store.auditLog.filter(entry => entry.action === 'ADMIN_PASS_MARK_UPDATED').map(entry => [entry.subject, entry.metadata])).toEqual([
      [course, { minimumGrade: 'C', previous: 'default D+' }],
      [course, { minimumGrade: 'default D+', previous: 'C' }]
    ]);
  });

  it('refuses other grades, malformed course codes and removing a pass mark that does not exist', async () => {
    const { app, as } = await setup();
    for (const [code, body] of [['MATH 141', { minimumGrade: 'D' }], ['MATH 141', { minimumGrade: 'B' }], ['MATH 141', {}], ['MATH141', { minimumGrade: 'C' }], ['$where', { minimumGrade: 'C' }], ['MATH 141', { minimumGrade: 'C', note: 'x'.repeat(501) }]] as const) {
      expect((await as(request(app).put(`/api/v1/admin/settings/pass-marks/${encodeURIComponent(code)}`)).send(body)).status).toBe(400);
    }
    expect((await as(request(app).delete('/api/v1/admin/settings/pass-marks/MATH%20141'))).status).toBe(404);
  });
});
