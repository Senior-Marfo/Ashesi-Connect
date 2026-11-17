import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Enrollment, RefreshToken, Student, User } from '../models.js';
import { UnsafeSeedTargetError, removeSyntheticRecords, seedSyntheticRecords } from './apply.js';
import { generateSyntheticDataset } from './synthetic-data.js';

const dataset = generateSyntheticDataset({ count: 30, today: new Date('2026-11-17T00:00:00Z') });
const models = [User, RefreshToken, Student, Enrollment] as unknown as mongoose.Model<unknown>[];

// Needs a MongoDB binary download, so it runs only when MONGO_INTEGRATION=1 (the CI integration job).
describe.runIf(process.env.MONGO_INTEGRATION === '1')('synthetic seeding against MongoDB', () => {
  let server: MongoMemoryServer;
  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri());
    await Promise.all(models.map(model => model.syncIndexes()));
  }, 120_000);
  afterAll(async () => {
    await mongoose.disconnect();
    await server?.stop();
  });
  beforeEach(async () => { await Promise.all(models.map(model => model.deleteMany({}))); });

  it('creates students, enrollments and one account per student, and is repeatable', async () => {
    const first = await seedSyntheticRecords(dataset, 'hash-1');
    expect(first).toMatchObject({ students: 30, accountsCreated: 30 });
    await User.updateOne({ identifier: dataset.students[0].studentId }, { $set: { passwordHash: 'changed-by-student' } });

    const second = await seedSyntheticRecords(dataset, 'hash-2');
    expect(second.accountsCreated).toBe(0);
    expect(await Student.countDocuments()).toBe(30);
    expect(await Enrollment.countDocuments()).toBe(dataset.enrollments.length);
    const kept = await User.findOne({ identifier: dataset.students[0].studentId }).select('+passwordHash').lean();
    expect(kept?.passwordHash).toBe('changed-by-student');
  });

  it('refuses a database that holds real students', async () => {
    await Student.create({ studentId: '20260001', fullName: 'Real Person', programme: 'CS', yearGroup: 2026 });
    await expect(seedSyntheticRecords(dataset, 'hash')).rejects.toBeInstanceOf(UnsafeSeedTargetError);
    expect(await Student.countDocuments()).toBe(1);
  });

  it('refuses to take over a real account with a clashing ID', async () => {
    await User.create({ identifier: dataset.students[0].studentId, passwordHash: 'real', role: 'STUDENT' });
    await expect(seedSyntheticRecords(dataset, 'hash')).rejects.toBeInstanceOf(UnsafeSeedTargetError);
  });

  it('removes only synthetic records and their sessions', async () => {
    await seedSyntheticRecords(dataset, 'hash');
    const admin = await User.create({ identifier: 'STF-0001', passwordHash: 'h', role: 'ADMIN' });
    const student = await User.findOne({ identifier: dataset.students[0].studentId }).lean();
    await RefreshToken.create({ tokenHash: 't1', userId: String(student?._id), familyId: 'f', expiresAt: new Date(Date.now() + 60_000) });
    await RefreshToken.create({ tokenHash: 't2', userId: String(admin._id), familyId: 'g', expiresAt: new Date(Date.now() + 60_000) });

    expect(await removeSyntheticRecords()).toMatchObject({ students: 30, accounts: 30 });
    expect(await Student.countDocuments()).toBe(0);
    expect(await Enrollment.countDocuments()).toBe(0);
    expect(await User.countDocuments()).toBe(1);
    expect(await RefreshToken.countDocuments()).toBe(1);
  });
});
