import { isValidObjectId } from 'mongoose';
import { isRole } from '../auth/permissions.js';
import { AuditLog, Enrollment, Message, MessageReceipt, RefreshToken, Student, User } from '../models.js';
import { CurriculumRecord } from '../models/curriculum.js';
import { selectCohortCurriculum } from '../domain/eligibility/cohort-selection.js';
import type { ProgrammeRules } from '../domain/eligibility/programme-audit.js';
import { PROVISIONAL_PASSING_GRADES } from '../register/provisional-pass.js';
import type { AuditEntry, CourseRecord, CourseSummary, MessageAudience, MessagePriority, MessageRecord, Repositories, StudentSummary, UserRecord } from './types.js';

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

const studentProjection = { _id: 0, studentId: 1, fullName: 1, programme: 1, yearGroup: 1, track: 1, synthetic: 1 } as const;

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
    messages: {
      async send(message, recipientIds) {
        const doc = await Message.create({ ...message, recipientCount: recipientIds.length });
        const messageId = String(doc._id);
        for (let i = 0; i < recipientIds.length; i += 1000) {
          await MessageReceipt.insertMany(recipientIds.slice(i, i + 1000).map(studentId => ({ messageId, studentId, deliveredAt: message.sentAt })), { ordered: false });
        }
        return { ...message, id: messageId, recipientCount: recipientIds.length };
      },
      async inbox(studentId, limit) {
        const receipts = await MessageReceipt.find({ studentId }).sort({ deliveredAt: -1 }).limit(limit).lean();
        const messages = await Message.find({ _id: { $in: receipts.map(receipt => receipt.messageId).filter(isValidObjectId) } }).lean();
        const byId = new Map(messages.map(message => [String(message._id), message]));
        return receipts.flatMap(receipt => {
          const message = byId.get(receipt.messageId);
          return message ? [{
            id: receipt.messageId, title: message.title, body: message.body, priority: message.priority as MessagePriority,
            sentAt: message.sentAt, readAt: receipt.readAt ?? undefined
          }] : [];
        });
      },
      unreadCount: studentId => MessageReceipt.countDocuments({ studentId, readAt: { $exists: false } }),
      async markRead(studentId, messageId) {
        const result = await MessageReceipt.updateMany({ studentId, readAt: { $exists: false }, ...(messageId ? { messageId } : {}) }, { $set: { readAt: new Date() } });
        return result.modifiedCount;
      },
      async listSent(limit) {
        const messages = await Message.find({}).sort({ sentAt: -1 }).limit(limit).lean();
        const reads = await MessageReceipt.aggregate<{ _id: string; readCount: number }>([
          { $match: { messageId: { $in: messages.map(message => String(message._id)) }, readAt: { $exists: true } } },
          { $group: { _id: '$messageId', readCount: { $sum: 1 } } }
        ]);
        const readCounts = new Map(reads.map(read => [read._id, read.readCount]));
        return messages.map(message => ({
          id: String(message._id), title: message.title, body: message.body, priority: message.priority as MessagePriority,
          audience: message.audience as MessageAudience, senderId: message.senderId, sentAt: message.sentAt,
          recipientCount: message.recipientCount, readCount: readCounts.get(String(message._id)) ?? 0
        } satisfies MessageRecord & { readCount: number }));
      }
    },
    curricula: {
      async findReviewed(programme, track, yearGroup) {
        const records = (await CurriculumRecord.find({ programme, track, status: 'REVIEWED', validationIssues: { $size: 0 } })
          .select('version rules status validationIssues sources -_id').limit(200).lean()) as unknown as Array<{ version: unknown; rules: unknown; validationIssues?: unknown; sources?: unknown }>;
        const selection = selectCohortCurriculum(yearGroup, records.map(record => ({
          version: String(record.version),
          status: 'REVIEWED' as const,
          validationIssues: Array.isArray(record.validationIssues) ? record.validationIssues.map(String) : ['INVALID_VALIDATION_ISSUES'],
          sources: Array.isArray(record.sources) ? record.sources.map((source: { effectiveYear?: unknown }) => ({ effectiveYear: typeof source.effectiveYear === 'number' ? source.effectiveYear : Number.NaN })) : []
        })));
        const selected = records.find(record => String(record.version) === selection.selectedVersion);
        return selected ? { version: String(selected.version), rules: { ...(selected.rules as ProgrammeRules), verifiedByRegistry: false } } : undefined;
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
      async list(filter) {
        const query: Record<string, unknown> = {};
        if (filter.programme) query.programme = filter.programme;
        if (filter.yearGroup !== undefined) query.yearGroup = filter.yearGroup;
        const docs = await Student.find(query, studentProjection).sort({ studentId: 1 }).lean();
        return docs as StudentSummary[];
      },
      async courseSummaries(studentIds) {
        if (studentIds.length === 0) return [];
        const latest = { $arrayElemAt: ['$attempts', -1] };
        const credits = (condition: object) => ({ $sum: { $cond: [condition, '$latest.credits', 0] } });
        const count = (condition: object) => ({ $sum: { $cond: [condition, 1, 0] } });
        const graded = { $and: [{ $eq: ['$latest.status', 'COMPLETED'] }, { $ne: [{ $ifNull: ['$latest.grade', null] }, null] }] };
        const passed = { $and: [graded, { $in: ['$latest.grade', PROVISIONAL_PASSING_GRADES] }] };
        const failed = { $and: [graded, { $not: [{ $in: ['$latest.grade', PROVISIONAL_PASSING_GRADES] }] }] };
        const docs = await Enrollment.aggregate<CourseSummary>([
          { $match: { studentId: { $in: studentIds }, 'attempts.0': { $exists: true } } },
          { $project: { studentId: 1, latest } },
          { $group: {
            _id: '$studentId',
            coursesOnRecord: { $sum: 1 },
            passedCredits: credits(passed),
            inProgressCredits: credits({ $eq: ['$latest.status', 'ENROLLED'] }),
            unresolvedFailures: count(failed),
            incompletes: count({ $eq: ['$latest.status', 'INCOMPLETE'] })
          } },
          { $project: { _id: 0, studentId: '$_id', coursesOnRecord: 1, passedCredits: 1, inProgressCredits: 1, unresolvedFailures: 1, incompletes: 1 } }
        ]);
        return docs;
      },
      async coursesFor(studentIds) {
        const byStudent = new Map<string, CourseRecord[]>();
        if (studentIds.length === 0) return byStudent;
        const docs = await Enrollment.find({ studentId: { $in: studentIds } }, { _id: 0, studentId: 1, courseCode: 1, attempts: 1 }).lean();
        for (const doc of docs) {
          const list = byStudent.get(doc.studentId) ?? [];
          list.push({ courseCode: doc.courseCode, attempts: doc.attempts.map(attempt => ({
            credits: attempt.credits, grade: attempt.grade ?? undefined, status: attempt.status as CourseRecord['attempts'][number]['status'],
            semester: attempt.semester ?? undefined, attemptedAt: attempt.attemptedAt ?? undefined
          })) });
          byStudent.set(doc.studentId, list);
        }
        return byStudent;
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
