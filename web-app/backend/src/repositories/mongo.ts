import { isValidObjectId } from 'mongoose';
import { isRole } from '../auth/permissions.js';
import { DEFAULT_STANDING_CONFIG } from '../domain/eligibility/standing.js';
import { AuditLog, Enrollment, ImportBatchModel, SettingsModel, Message, MessageReceipt, PassMarkModel, RefreshToken, Student, StudentNoteModel, User } from '../models.js';
import { CurriculumRecord } from '../models/curriculum.js';
import { selectCohortCurriculum } from '../domain/eligibility/cohort-selection.js';
import type { ProgrammeRules } from '../domain/eligibility/programme-audit.js';
import { passingGradesByCourse } from '../domain/eligibility/pass-marks.js';
import type { AuditEntry, CourseRecord, CourseSummary, ImportBatch, MessageAudience, MessagePriority, MessageRecord, PassMarkRecord, Repositories, StudentSummary, UserRecord } from './types.js';

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
      async listByRole(role) {
        const docs = await User.find({ role }, { identifier: 1, forcePasswordChange: 1, lockedUntil: 1 }).sort({ identifier: 1 }).lean();
        return docs.map(doc => ({ id: String(doc._id), identifier: doc.identifier, forcePasswordChange: doc.forcePasswordChange ?? true, lockedUntil: doc.lockedUntil ?? undefined }));
      },
      async removeByIdentifier(identifier) {
        await User.deleteOne({ identifier });
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
    settings: {
      async get() {
        const doc = await SettingsModel.findById('app').lean();
        const standing = { ...DEFAULT_STANDING_CONFIG, ...Object.fromEntries(Object.entries(doc?.standing ?? {}).filter(([, value]) => typeof value === 'number')) };
        return { standing, updatedAt: doc?.updatedAt ?? undefined, updatedBy: doc?.updatedBy ?? undefined };
      },
      async update(settings) {
        await SettingsModel.updateOne({ _id: 'app' }, { $set: settings }, { upsert: true });
      }
    },
    passMarks: {
      async list() {
        const docs = await PassMarkModel.find({}, { _id: 0, __v: 0 }).sort({ courseCode: 1 }).lean();
        return docs.map(doc => ({ ...doc, note: doc.note ?? undefined }) as PassMarkRecord);
      },
      async find(courseCode) {
        const doc = await PassMarkModel.findOne({ courseCode }, { _id: 0, __v: 0 }).lean();
        return doc ? ({ ...doc, note: doc.note ?? undefined } as PassMarkRecord) : undefined;
      },
      async set(record) {
        const { note, ...fields } = record;
        await PassMarkModel.updateOne({ courseCode: record.courseCode }, { $set: { ...fields, ...(note ? { note } : {}) }, ...(note ? {} : { $unset: { note: 1 } }) }, { upsert: true });
      },
      async remove(courseCode) {
        await PassMarkModel.deleteOne({ courseCode });
      }
    },
    notes: {
      async add(note) {
        const doc = await StudentNoteModel.create(note);
        return { ...note, id: String(doc._id) };
      },
      async listFor(studentId, limit) {
        const docs = await StudentNoteModel.find({ studentId }).sort({ createdAt: -1, _id: -1 }).limit(limit).lean();
        return docs.map(doc => ({ id: String(doc._id), studentId: doc.studentId, body: doc.body, authorId: doc.authorId, createdAt: doc.createdAt }));
      }
    },
    imports: {
      async create(batch) {
        const doc = await ImportBatchModel.create(batch);
        return { ...batch, id: String(doc._id) };
      },
      async list(limit) {
        const docs = await ImportBatchModel.find({}, { undo: 0 }).sort({ createdAt: -1 }).limit(limit).lean();
        return docs.map(({ _id, __v: _version, ...rest }) => ({ ...(rest as unknown as Omit<ImportBatch, 'id' | 'undo'>), id: String(_id) }));
      },
      async find(id) {
        if (!isValidObjectId(id)) return undefined;
        const doc = await ImportBatchModel.findById(id).lean();
        if (!doc) return undefined;
        const { _id, __v: _version, ...rest } = doc;
        return { ...(rest as unknown as Omit<ImportBatch, 'id'>), id: String(_id) };
      },
      async latestApplied() {
        const doc = await ImportBatchModel.findOne({ status: 'APPLIED' }).sort({ createdAt: -1 }).lean();
        if (!doc) return undefined;
        const { _id, __v: _version, ...rest } = doc;
        return { ...(rest as unknown as Omit<ImportBatch, 'id'>), id: String(_id) };
      },
      async markRolledBack(id, at) {
        await ImportBatchModel.updateOne({ _id: id }, { $set: { status: 'ROLLED_BACK', rolledBackAt: at } });
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
      async inbox(studentId, limit, now) {
        const receipts = await MessageReceipt.find({ studentId, deliveredAt: { $lte: now } }).sort({ deliveredAt: -1 }).limit(limit).lean();
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
      unreadCount: (studentId, now) => MessageReceipt.countDocuments({ studentId, deliveredAt: { $lte: now }, readAt: { $exists: false } }),
      async markRead(studentId, now, messageId) {
        const result = await MessageReceipt.updateMany({ studentId, deliveredAt: { $lte: now }, readAt: { $exists: false }, ...(messageId ? { messageId } : {}) }, { $set: { readAt: now } });
        return result.modifiedCount;
      },
      async cancelScheduled(messageId, now) {
        if (!isValidObjectId(messageId)) return false;
        const deleted = await Message.deleteOne({ _id: messageId, sentAt: { $gt: now } });
        if (deleted.deletedCount !== 1) return false;
        await MessageReceipt.deleteMany({ messageId });
        return true;
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
      async courseSummaries(studentIds, passMarks) {
        if (studentIds.length === 0) return [];
        const latest = { $arrayElemAt: ['$attempts', -1] };
        const credits = (condition: object) => ({ $sum: { $cond: [condition, '$latest.credits', 0] } });
        const count = (condition: object) => ({ $sum: { $cond: [condition, 1, 0] } });
        const graded = { $and: [{ $eq: ['$latest.status', 'COMPLETED'] }, { $ne: [{ $ifNull: ['$latest.grade', null] }, null] }] };
        const { overrides, fallback } = passingGradesByCourse(passMarks);
        const passingGrades = overrides.length
          ? { $switch: { branches: overrides.map(group => ({ case: { $in: ['$courseCode', group.courseCodes] }, then: group.grades })), default: fallback } }
          : fallback;
        const passes = { $in: ['$latest.grade', passingGrades] };
        const passed = { $and: [graded, passes] };
        const failed = { $and: [graded, { $not: [passes] }] };
        const docs = await Enrollment.aggregate<CourseSummary>([
          { $match: { studentId: { $in: studentIds }, 'attempts.0': { $exists: true } } },
          { $project: { studentId: 1, courseCode: 1, latest } },
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
      async upsert(student) {
        const { synthetic, ...fields } = student;
        await Student.updateOne({ studentId: student.studentId }, { $set: fields, ...(synthetic ? {} : { $unset: { synthetic: 1 } }) }, { upsert: true });
      },
      async remove(studentId) {
        await Student.deleteOne({ studentId });
      },
      async setCourse(studentId, courseCode, attempts) {
        if (attempts === null) await Enrollment.deleteOne({ studentId, courseCode });
        else await Enrollment.updateOne({ studentId, courseCode }, { $set: { attempts } }, { upsert: true });
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
