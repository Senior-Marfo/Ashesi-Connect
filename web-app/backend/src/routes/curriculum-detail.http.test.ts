import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { StoredCurriculum } from '../repositories/types.js';
import { ADMIN_PASSWORD, buildTestApp } from '../testing/fixtures.js';

const draft: StoredCurriculum = {
  programme: 'CS', track: 'standard', version: '2028-v1', status: 'DRAFT', validationIssues: [],
  rules: {
    programme: 'CS', track: 'standard', totalCredits: 3, verifiedByRegistry: false,
    requiredCourses: [{ courseCode: 'CS 111', credits: 1, minimumGrade: 'D+', category: 'Core' }],
    electivePools: [{ category: 'Non-Major Electives', creditsRequired: 2, courseCodes: ['AS 101', 'ECON 210'], africanStudiesMinimum: 1, africanStudiesCodes: ['AS 101'] }]
  },
  sources: [{ sourceUrl: 'https://registry.example.edu/audit.xlsx', sourceKind: 'REGISTRY_PROVIDED_WORKBOOK', retrievedAt: '2026-11-17T00:00:00Z', effectiveYear: 2028, contentHash: 'abc' }]
};

async function setup() {
  const built = await buildTestApp();
  built.store.curricula.push({ ...structuredClone(draft), yearGroup: 2028 });
  const token = (await request(built.app).post('/api/v1/auth/login').send({ identifier: 'STF-1001', password: ADMIN_PASSWORD })).body.accessToken as string;
  return { ...built, get: (path: string) => request(built.app).get(path).auth(token, { type: 'bearer' }) };
}

afterEach(() => {
  delete process.env.ENABLE_CURRICULUM_REVIEW;
  delete process.env.CURRICULUM_REVIEWER_IDS;
});

describe('curriculum detail for reviewers', () => {
  it('returns one version with its full rules, issues and sources', async () => {
    const { get } = await setup();
    const response = await get('/api/v1/admin/curricula/detail?programme=CS&track=standard&version=2028-v1');
    expect(response.status).toBe(200);
    expect(response.body.curriculum).toMatchObject({ status: 'DRAFT', validationIssues: [], rules: { totalCredits: 3 } });
    expect(response.body.curriculum.rules.electivePools[0].africanStudiesCodes).toEqual(['AS 101']);
  });

  it('answers 404 for an unknown version and 400 without the identifying fields', async () => {
    const { get } = await setup();
    expect((await get('/api/v1/admin/curricula/detail?programme=CS&track=standard&version=2028-v9')).status).toBe(404);
    expect((await get('/api/v1/admin/curricula/detail?programme=CS')).status).toBe(400);
  });

  it('shows a reviewed version with the reviewer by staff ID', async () => {
    const { get, store } = await setup();
    Object.assign(store.curricula[0], { status: 'REVIEWED', review: { reviewerId: 'u-admin-1', reviewedAt: new Date('2026-11-18T00:00:00Z'), evidenceReference: 'Registry memo 7' } });
    const { body } = await get('/api/v1/admin/curricula/detail?programme=CS&track=standard&version=2028-v1');
    expect(body.curriculum.review).toMatchObject({ reviewerIdentifier: 'STF-1001', evidenceReference: 'Registry memo 7' });
  });
});

describe('review access', () => {
  it('says whether review is switched on and whether this admin may review', async () => {
    const { get } = await setup();
    expect((await get('/api/v1/admin/curricula/review-access')).body).toEqual({ enabled: false, allowed: false });
    process.env.ENABLE_CURRICULUM_REVIEW = 'yes';
    expect((await get('/api/v1/admin/curricula/review-access')).body).toEqual({ enabled: true, allowed: false });
    process.env.CURRICULUM_REVIEWER_IDS = 'u-admin-1';
    expect((await get('/api/v1/admin/curricula/review-access')).body).toEqual({ enabled: true, allowed: true });
  });
});

describe('reviewing a draft', () => {
  const body = { programme: 'CS', track: 'standard', version: '2028-v1', evidenceReference: 'Registry memo 7' };

  it('reviews a valid draft once, logs it, and from then on it applies to that cohort', async () => {
    process.env.ENABLE_CURRICULUM_REVIEW = 'yes';
    process.env.CURRICULUM_REVIEWER_IDS = 'u-admin-1';
    const { app, store, repositories } = await setup();
    const token = (await request(app).post('/api/v1/auth/login').send({ identifier: 'STF-1001', password: ADMIN_PASSWORD })).body.accessToken as string;
    const review = () => request(app).post('/api/v1/admin/curricula/review').auth(token, { type: 'bearer' }).send(body);

    expect(await repositories.curricula.findReviewed('CS', 'standard', 2028)).toBeUndefined();
    const first = await review();
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ curriculum: { status: 'REVIEWED', review: { reviewerId: 'u-admin-1', evidenceReference: 'Registry memo 7' } }, officialCertification: false });
    expect(await repositories.curricula.findReviewed('CS', 'standard', 2028)).toMatchObject({ version: '2028-v1' });
    expect(store.auditLog.filter(entry => entry.action === 'ADMIN_CURRICULUM_REVIEWED').map(entry => [entry.subject, entry.metadata])).toEqual([['CS/standard/2028-v1', { evidenceReference: 'Registry memo 7' }]]);

    const second = await review();
    expect(second.status).toBe(409);
    // Already reviewed: the review rules refuse anything that is not a draft (the conflict code covers races).
    expect(second.body.error).toBe('CURRICULUM_REVIEW_BLOCKED');
  });

  it('refuses drafts with validation issues, unknown versions, and admins not on the list', async () => {
    process.env.ENABLE_CURRICULUM_REVIEW = 'yes';
    process.env.CURRICULUM_REVIEWER_IDS = 'u-admin-1';
    const { app, store } = await setup();
    const token = (await request(app).post('/api/v1/auth/login').send({ identifier: 'STF-1001', password: ADMIN_PASSWORD })).body.accessToken as string;
    const review = (overrides: object) => request(app).post('/api/v1/admin/curricula/review').auth(token, { type: 'bearer' }).send({ ...body, ...overrides });

    expect((await review({ version: '2028-v9' })).status).toBe(404);
    store.curricula[0].validationIssues = ['EMPTY_ELECTIVE_OPTIONS'];
    const blocked = await review({});
    expect(blocked.status).toBe(409);
    expect(blocked.body).toMatchObject({ error: 'CURRICULUM_REVIEW_BLOCKED', issues: ['EMPTY_ELECTIVE_OPTIONS'] });

    process.env.CURRICULUM_REVIEWER_IDS = 'someone-else';
    expect((await review({})).status).toBe(403);
    expect(store.auditLog.some(entry => entry.action === 'ADMIN_CURRICULUM_REVIEWED')).toBe(false);
  });
});
