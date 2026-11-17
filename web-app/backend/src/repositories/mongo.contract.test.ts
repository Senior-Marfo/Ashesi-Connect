import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe } from 'vitest';
import { AuditLog, Enrollment, ImportBatchModel, SettingsModel, StudentNoteModel, Message, MessageReceipt, RefreshToken, Student, User } from '../models.js';
import { repositoryContract } from './contract.js';
import { createMongoRepositories } from './mongo.js';

// Needs a MongoDB binary download, so it runs only when MONGO_INTEGRATION=1 (the CI integration job).
const models = [User, RefreshToken, AuditLog, Student, Enrollment, Message, MessageReceipt, ImportBatchModel, SettingsModel, StudentNoteModel] as unknown as mongoose.Model<unknown>[];

describe.runIf(process.env.MONGO_INTEGRATION === '1')('MongoDB', () => {
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

  repositoryContract('mongo', {
    repositories: createMongoRepositories,
    async addCourses(studentId, courses) {
      await Enrollment.insertMany(courses.map(course => ({ studentId, ...course })));
    },
    async reset() {
      await Promise.all(models.map(model => model.deleteMany({})));
      const user = await User.create({ identifier: '20280001', passwordHash: 'hash', role: 'STUDENT', studentId: '20280001', forcePasswordChange: false });
      await Student.create({ studentId: '20280001', fullName: 'Synthetic Student', programme: 'CS', yearGroup: 2028, track: 'standard' });
      await Enrollment.create({ studentId: '20280001', courseCode: 'CS 111', attempts: [{ credits: 1, grade: 'B', status: 'COMPLETED', semester: '2024 Fall' }] });
      return String(user._id);
    }
  });
});
