import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { syntheticProgrammeRules } from '../seed/synthetic-curriculum.js';
import { generateSyntheticDataset } from '../seed/synthetic-data.js';
import { ADMIN_PASSWORD, STUDENT_PASSWORD, buildTestApp } from '../testing/fixtures.js';

type Built = Awaited<ReturnType<typeof buildTestApp>>;

async function token(app: Built['app'], identifier: string, password: string) {
  return (await request(app).post('/api/v1/auth/login').send({ identifier, password })).body.accessToken as string;
}

/** Turns fixture student 20260001 into a synthetic student carrying a generated 2028 record. */
function makeSynthetic({ store }: Built) {
  const dataset = generateSyntheticDataset({ count: 50, today: new Date('2026-11-17T00:00:00Z') });
  const source = dataset.students.find(student => student.yearGroup === 2028 && student.programme === 'CS')!;
  Object.assign(store.students[0], { programme: source.programme, track: source.track, yearGroup: 2028, synthetic: true });
  store.courses.set('20260001', dataset.enrollments.filter(e => e.studentId === source.studentId).map(({ courseCode, attempts }) => ({ courseCode, attempts })));
}

describe('eligibility API', () => {
  it('never applies synthetic rules to a real student without a reviewed curriculum', async () => {
    const built = await buildTestApp();
    const response = await request(built.app).get('/api/v1/students/me/eligibility').auth(await token(built.app, '20260001', STUDENT_PASSWORD), { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'NO_CURRICULUM', curriculum: null, standing: null, audit: null, officialCertification: false, expectedGraduation: '2028 Spring' });
  });

  it('assesses a real student against their Registry-reviewed curriculum', async () => {
    const built = await buildTestApp();
    built.store.curricula.push({
      programme: 'CS', track: 'standard', yearGroup: 2028, version: '2028-v1',
      rules: { programme: 'CS', track: 'standard', totalCredits: 2, verifiedByRegistry: true, electivePools: [],
        requiredCourses: [{ courseCode: 'CS 111', credits: 1, minimumGrade: 'D+', category: 'Computing' }, { courseCode: 'CS 400', credits: 1, minimumGrade: 'C', category: 'Capstone' }] }
    });
    const body = (await request(built.app).get('/api/v1/students/me/eligibility').auth(await token(built.app, '20260001', STUDENT_PASSWORD), { type: 'bearer' })).body;
    expect(body).toMatchObject({ status: 'REQUIREMENTS_REMAINING', curriculum: { basis: 'REVIEWED', version: '2028-v1' }, audit: { creditsEarned: 1, creditsRequired: 2 } });
    expect(body.standing).toMatchObject({ level: 'GREEN', termsRemaining: 3 });
    expect(body.nextActions).toEqual([{ kind: 'TAKE_COURSE', code: 'CS 400', category: 'Capstone', credits: 1 }]);
  });

  it('assesses a synthetic student against the synthetic rules, with the full requirement breakdown', async () => {
    const built = await buildTestApp();
    makeSynthetic(built);
    const body = (await request(built.app).get('/api/v1/students/me/eligibility').auth(await token(built.app, '20260001', STUDENT_PASSWORD), { type: 'bearer' })).body;
    expect(body.curriculum).toEqual({ basis: 'SYNTHETIC', version: 'SYNTHETIC-1' });
    expect(body.status).toBe('REQUIREMENTS_REMAINING');
    expect(body.audit.creditsRequired).toBe(syntheticProgrammeRules('CS', body.student.track)!.totalCredits);
    expect(body.audit.creditsInProgress).toBeGreaterThan(0);
    expect(['GREEN', 'YELLOW', 'RED']).toContain(body.standing.level);
    expect(body.requirements.map((group: { category: string }) => group.category)).toEqual(expect.arrayContaining(['Major', 'Capstone', 'Major Electives', 'African Studies']));
    expect(body.nextActions.length).toBeGreaterThan(0);
  });

  it('reports data issues instead of guessing when a grade is not on the scale', async () => {
    const built = await buildTestApp();
    makeSynthetic(built);
    built.store.courses.get('20260001')!.push({ courseCode: 'CS 999', attempts: [{ credits: 1, grade: 'P', status: 'COMPLETED' }] });
    const body = (await request(built.app).get('/api/v1/students/me/eligibility').auth(await token(built.app, '20260001', STUDENT_PASSWORD), { type: 'bearer' })).body;
    expect(body).toMatchObject({ status: 'DATA_ISSUES', issues: ['UNKNOWN_GRADE:CS 999'], standing: null });
  });

  it('lets admins view any student and records the view', async () => {
    const built = await buildTestApp();
    makeSynthetic(built);
    const response = await request(built.app).get('/api/v1/admin/students/20260001/eligibility').auth(await token(built.app, 'STF-1001', ADMIN_PASSWORD), { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.curriculum.basis).toBe('SYNTHETIC');
    expect(built.store.auditLog.some(entry => entry.action === 'ADMIN_ELIGIBILITY_VIEWED' && entry.subject === '20260001')).toBe(true);
    expect((await request(built.app).get('/api/v1/admin/students/missing/eligibility').auth(await token(built.app, 'STF-1001', ADMIN_PASSWORD), { type: 'bearer' })).status).toBe(404);
  });

  it('returns only the signed-in student, whatever the query says', async () => {
    const built = await buildTestApp();
    const response = await request(built.app).get('/api/v1/students/me/eligibility').query({ studentId: '20260002' }).auth(await token(built.app, '20260001', STUDENT_PASSWORD), { type: 'bearer' });
    expect(response.body.student.studentId).toBe('20260001');
  });
});
