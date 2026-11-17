import { Enrollment, RefreshToken, Student, User } from '../models.js';
import type { SyntheticDataset } from './synthetic-data.js';

const BATCH = 1000;

export class UnsafeSeedTargetError extends Error {}

/**
 * Refuses to write when the database already holds real (non-synthetic) students,
 * so generated records are never mixed into a live academic database.
 */
export async function assertSyntheticOnlyTarget(): Promise<void> {
  const real = await Student.countDocuments({ synthetic: { $ne: true } });
  if (real > 0) throw new UnsafeSeedTargetError(`Refusing to seed: the database holds ${real} non-synthetic student record(s)`);
}

/**
 * Replaces all synthetic students and enrollments with the dataset and creates
 * a sign-in account for each synthetic student that does not have one yet.
 * Existing synthetic accounts keep their passwords. Real accounts with a
 * clashing ID make the write fail rather than being modified.
 */
export async function seedSyntheticRecords(dataset: SyntheticDataset, studentPasswordHash: string) {
  await assertSyntheticOnlyTarget();
  const ids = dataset.students.map(student => student.studentId);
  const clash = await User.findOne({ identifier: { $in: ids }, synthetic: { $ne: true } }).select('identifier').lean();
  if (clash) throw new UnsafeSeedTargetError(`Refusing to seed: ${clash.identifier} belongs to a non-synthetic account`);

  await Promise.all([Student.deleteMany({ synthetic: true }), Enrollment.deleteMany({ synthetic: true })]);
  for (let i = 0; i < dataset.students.length; i += BATCH) await Student.insertMany(dataset.students.slice(i, i + BATCH), { ordered: false });
  for (let i = 0; i < dataset.enrollments.length; i += BATCH) await Enrollment.insertMany(dataset.enrollments.slice(i, i + BATCH), { ordered: false });

  const staleAccounts = await User.find({ synthetic: true, role: 'STUDENT', identifier: { $nin: ids } }).select('_id').lean();
  await removeAccounts(staleAccounts.map(account => String(account._id)));
  let accountsCreated = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const result = await User.bulkWrite(ids.slice(i, i + BATCH).map(identifier => ({
      updateOne: {
        filter: { identifier, synthetic: true },
        update: { $setOnInsert: { identifier, studentId: identifier, role: 'STUDENT', passwordHash: studentPasswordHash, forcePasswordChange: false, failedLogins: 0, synthetic: true } },
        upsert: true
      }
    })), { ordered: false });
    accountsCreated += result.upsertedCount;
  }
  return { students: dataset.students.length, enrollments: dataset.enrollments.length, accountsCreated, accountsRemoved: staleAccounts.length };
}

/** Deletes every synthetic student, enrollment and account, and their sessions. Real records are untouched. */
export async function removeSyntheticRecords() {
  const accounts = await User.find({ synthetic: true }).select('_id').lean();
  const [students, enrollments] = await Promise.all([Student.deleteMany({ synthetic: true }), Enrollment.deleteMany({ synthetic: true })]);
  await removeAccounts(accounts.map(account => String(account._id)));
  return { students: students.deletedCount, enrollments: enrollments.deletedCount, accounts: accounts.length };
}

async function removeAccounts(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  await RefreshToken.deleteMany({ userId: { $in: userIds } });
  await User.deleteMany({ _id: { $in: userIds }, synthetic: true });
}
