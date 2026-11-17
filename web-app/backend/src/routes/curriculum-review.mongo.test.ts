import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CurriculumRecord } from '../models/curriculum.js';
import { ADMIN_PASSWORD, buildTestApp } from '../testing/fixtures.js';

// Needs a MongoDB binary download, so it runs only when MONGO_INTEGRATION=1 (the CI integration job).
describe.runIf(process.env.MONGO_INTEGRATION === '1')('curriculum review against MongoDB', () => {
  let server: MongoMemoryServer;
  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri());
  }, 120_000);
  afterAll(async () => {
    await mongoose.disconnect();
    await server?.stop();
  });
  afterEach(async () => {
    await CurriculumRecord.deleteMany({});
    delete process.env.ENABLE_CURRICULUM_REVIEW;
    delete process.env.CURRICULUM_REVIEWER_IDS;
  });

  it('marks a valid draft reviewed once, records it in the audit log, and refuses a second review', async () => {
    await CurriculumRecord.create({
      programme: 'CS', track: 'standard', version: '2028-v1', status: 'DRAFT', validationIssues: [],
      rules: { programme: 'CS', track: 'standard', totalCredits: 1, verifiedByRegistry: false, requiredCourses: [{ courseCode: 'CS 111', credits: 1, minimumGrade: 'D+', category: 'Core' }], electivePools: [] },
      sources: [{ sourceUrl: 'https://registry.example.edu/audit.xlsx', sourceKind: 'REGISTRY_PROVIDED_WORKBOOK', retrievedAt: '2026-11-17T00:00:00Z', effectiveYear: 2028, contentHash: 'abc' }]
    });
    process.env.ENABLE_CURRICULUM_REVIEW = 'yes';
    process.env.CURRICULUM_REVIEWER_IDS = 'u-admin-1';
    const { app, store } = await buildTestApp();
    const token = (await request(app).post('/api/v1/auth/login').send({ identifier: 'STF-1001', password: ADMIN_PASSWORD })).body.accessToken as string;
    const review = () => request(app).post('/api/v1/admin/curricula/review').auth(token, { type: 'bearer' })
      .send({ programme: 'CS', track: 'standard', version: '2028-v1', evidenceReference: 'Registry memo 7' });

    const first = await review();
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ curriculum: { status: 'REVIEWED' }, officialCertification: false });
    expect(store.auditLog.find(entry => entry.action === 'ADMIN_CURRICULUM_REVIEWED')).toMatchObject({ subject: 'CS/standard/2028-v1', actorId: 'u-admin-1', metadata: { evidenceReference: 'Registry memo 7' } });
    expect((await review()).status).toBe(409);
    expect(store.auditLog.filter(entry => entry.action === 'ADMIN_CURRICULUM_REVIEWED')).toHaveLength(1);
  });
});
