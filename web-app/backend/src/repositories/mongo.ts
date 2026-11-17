import { isValidObjectId } from 'mongoose';
import { isRole } from '../auth/permissions.js';
import { AuditLog, Enrollment, RefreshToken, Student, User } from '../models.js';
import type { AuditEntry, CourseRecord, Repositories, StudentSummary, UserRecord } from './types.js';

function toUser(doc: { _id: unknown; identifier: string; passwordHash: string; role: string; studentId?: string | null; forcePasswordChange?: boolean | null; failedLogins?: number | null; lockedUntil?: Date | null; passwordChangedAt?: Date | null }): UserRecord {
  if (!isRole(doc.role)) throw new Error(`Unknown role on user ${String(doc._id)}`);
  return {
    id: String(doc._id),
    identifier: doc.identifier,
    passwordHash: doc.passwordHash,
    role: doc.role,
    studentId: doc.studentId ?? undefined,
    forcePasswordChange: doc.forcePasswordChange ?? true,
    failedLogins: doc.failedLogins ?? 0,
    lockedUntil: doc.lockedUntil ?? undefined,
    passwordChangedAt: doc.passwordChangedAt ?? undefined
  };
}

const studentProjection = { _id: 0, studentId: 1, fullName: 1, programme: 1, yearGroup: 1, track: 1 } as const;

export function createMongoRepositories(): Repositories {
  return {
    users: {
      async findByIdentifier(identifier) {
        const doc = await User.findOne({ identifier }).select('+passwordHash').lean();
        return doc ? toUser(doc) : undefined;
      },
      async findById(id) {
        if (!isValidObjectId(id)) return undefined;
        const doc = await User.findById(id).select('+passwordHash').lean();
        return doc ? toUser(doc) : undefined;
      },
      async update(id, changes) {
        const unset = Object.entries(changes).filter(([, value]) => value === undefined).map(([key]) => [key, 1]);
        const set = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));
        await User.updateOne({ _id: id }, { $set: set, ...(unset.length ? { $unset: Object.fromEntries(unset) } : {}) });
      },
      async createIfAbsent(user) {
        const result = await User.updateOne({ identifier: user.identifier }, { $setOnInsert: user }, { upsert: true });
        return result.upsertedCount === 1;
      }
    },
    refreshTokens: {
      async create(record) {
        await RefreshToken.create(record);
      },
      async findByHash(tokenHash) {
        const doc = await RefreshToken.findOne({ tokenHash }).lean();
        return doc ? {
          tokenHash: doc.tokenHash, userId: doc.userId, familyId: doc.familyId, expiresAt: doc.expiresAt,
          revokedAt: doc.revokedAt ?? undefined, replacedByHash: doc.replacedByHash ?? undefined
        } : undefined;
      },
      async revoke(tokenHash, replacedByHash) {
        const result = await RefreshToken.updateOne(
          { tokenHash, revokedAt: { $exists: false } },
          { $set: { revokedAt: new Date(), ...(replacedByHash ? { replacedByHash } : {}) } }
        );
        return result.modifiedCount === 1;
      },
      async revokeFamily(familyId) {
        await RefreshToken.updateMany({ familyId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
      },
      async revokeAllForUser(userId) {
        await RefreshToken.updateMany({ userId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
      }
    },
    auditLog: {
      async append(entry) {
        await AuditLog.create(entry);
      },
      async list({ limit, action }) {
        const docs = await AuditLog.find(action ? { action } : {}).sort({ at: -1 }).limit(limit).select({ _id: 0, __v: 0 }).lean();
        return docs as unknown as AuditEntry[];
      }
    },
    students: {
      async findById(studentId) {
        const doc = await Student.findOne({ studentId }, studentProjection).lean();
        return (doc as StudentSummary | null) ?? undefined;
      },
      async searchByIdPrefix(prefix, limit) {
        const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const docs = await Student.find(prefix ? { studentId: { $regex: `^${escaped}` } } : {}, studentProjection).sort({ studentId: 1 }).limit(limit).lean();
        return docs as StudentSummary[];
      },
      async listCourses(studentId) {
        const docs = await Enrollment.find({ studentId }, { _id: 0, courseCode: 1, attempts: 1 }).lean();
        return docs.map(doc => ({
          courseCode: doc.courseCode,
          attempts: doc.attempts.map(attempt => ({
            credits: attempt.credits,
            grade: attempt.grade ?? undefined,
            status: attempt.status as CourseRecord['attempts'][number]['status'],
            semester: attempt.semester ?? undefined,
            attemptedAt: attempt.attemptedAt ?? undefined
          }))
        }));
      }
    }
  };
}
