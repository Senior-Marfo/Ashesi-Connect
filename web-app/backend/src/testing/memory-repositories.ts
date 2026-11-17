import { PROVISIONAL_PASSING_GRADES } from '../register/provisional-pass.js';
import { DEFAULT_STANDING_CONFIG } from '../domain/eligibility/standing.js';
import type { AppSettings, AuditEntry, CourseRecord, CourseSummary, ImportBatch, MessageRecord, ReviewedCurriculum, RefreshTokenRecord, Repositories, StudentNote, StudentSummary, UserRecord } from '../repositories/types.js';

export interface MemoryStore {
  users: UserRecord[];
  refreshTokens: RefreshTokenRecord[];
  auditLog: AuditEntry[];
  students: StudentSummary[];
  courses: Map<string, CourseRecord[]>;
  curricula: Array<ReviewedCurriculum & { programme: string; track: string; yearGroup: number }>;
  messages: MessageRecord[];
  receipts: Array<{ messageId: string; studentId: string; deliveredAt: Date; readAt?: Date }>;
  imports: ImportBatch[];
  settings: AppSettings;
  notes: StudentNote[];
}

export function createMemoryRepositories(): { repositories: Repositories; store: MemoryStore } {
  const store: MemoryStore = { users: [], refreshTokens: [], auditLog: [], students: [], courses: new Map(), curricula: [], messages: [], receipts: [], imports: [], settings: { standing: { ...DEFAULT_STANDING_CONFIG } }, notes: [] };
  const revokeWhere = (predicate: (record: RefreshTokenRecord) => boolean) => {
    for (const record of store.refreshTokens) if (!record.revokedAt && predicate(record)) record.revokedAt = new Date();
  };

  const repositories: Repositories = {
    users: {
      findByIdentifier: async identifier => structuredClone(store.users.find(user => user.identifier === identifier)),
      findById: async id => structuredClone(store.users.find(user => user.id === id)),
      async update(id, changes) {
        const user = store.users.find(candidate => candidate.id === id);
        if (user) Object.assign(user, changes);
      },
      listByRole: async role => store.users.filter(user => user.role === role).sort((a, b) => a.identifier.localeCompare(b.identifier))
        .map(user => ({ id: user.id, identifier: user.identifier, forcePasswordChange: user.forcePasswordChange, lockedUntil: user.lockedUntil })),
      async removeByIdentifier(identifier) {
        store.users = store.users.filter(user => user.identifier !== identifier);
      },
      async createIfAbsent(user) {
        if (store.users.some(existing => existing.identifier === user.identifier)) return false;
        store.users.push({ ...user, id: `user-${store.users.length + 1}` });
        return true;
      }
    },
    refreshTokens: {
      async create(record) { store.refreshTokens.push({ ...record }); },
      findByHash: async tokenHash => structuredClone(store.refreshTokens.find(record => record.tokenHash === tokenHash)),
      async revoke(tokenHash, replacedByHash) {
        const record = store.refreshTokens.find(candidate => candidate.tokenHash === tokenHash);
        if (!record || record.revokedAt) return false;
        record.revokedAt = new Date();
        record.replacedByHash = replacedByHash;
        return true;
      },
      async revokeFamily(familyId) { revokeWhere(record => record.familyId === familyId); },
      async revokeAllForUser(userId) { revokeWhere(record => record.userId === userId); }
    },
    auditLog: {
      async append(entry) { store.auditLog.push(structuredClone(entry)); },
      list: async ({ limit, action }) =>
        store.auditLog.filter(entry => !action || entry.action === action).slice().reverse().slice(0, limit)
    },
    settings: {
      get: async () => structuredClone(store.settings),
      async update(settings) { store.settings = structuredClone(settings); }
    },
    notes: {
      async add(note) {
        const record = { ...structuredClone(note), id: `note-${store.notes.length + 1}` };
        store.notes.push(record);
        return structuredClone(record);
      },
      listFor: async (studentId, limit) => store.notes.filter(note => note.studentId === studentId).reverse().slice(0, limit).map(note => structuredClone(note))
    },
    imports: {
      async create(batch) {
        const record = { ...structuredClone(batch), id: `import-${store.imports.length + 1}` };
        store.imports.push(record);
        return structuredClone(record);
      },
      list: async limit => [...store.imports].reverse().slice(0, limit).map(({ undo: _undo, ...rest }) => structuredClone(rest)),
      find: async id => structuredClone(store.imports.find(batch => batch.id === id)),
      latestApplied: async () => structuredClone([...store.imports].reverse().find(batch => batch.status === 'APPLIED')),
      async markRolledBack(id, at) {
        const batch = store.imports.find(candidate => candidate.id === id);
        if (batch) Object.assign(batch, { status: 'ROLLED_BACK', rolledBackAt: at });
      }
    },
    messages: {
      async send(message, recipientIds) {
        const record: MessageRecord = { ...structuredClone(message), id: `message-${store.messages.length + 1}`, recipientCount: recipientIds.length };
        store.messages.push(record);
        for (const studentId of recipientIds) store.receipts.push({ messageId: record.id, studentId, deliveredAt: message.sentAt });
        return structuredClone(record);
      },
      async inbox(studentId, limit) {
        return store.receipts.filter(receipt => receipt.studentId === studentId)
          .sort((a, b) => b.deliveredAt.getTime() - a.deliveredAt.getTime()).slice(0, limit)
          .flatMap(receipt => {
            const message = store.messages.find(candidate => candidate.id === receipt.messageId);
            return message ? [{ id: message.id, title: message.title, body: message.body, priority: message.priority, sentAt: message.sentAt, readAt: receipt.readAt }] : [];
          });
      },
      unreadCount: async studentId => store.receipts.filter(receipt => receipt.studentId === studentId && !receipt.readAt).length,
      async markRead(studentId, messageId) {
        const pending = store.receipts.filter(receipt => receipt.studentId === studentId && !receipt.readAt && (!messageId || receipt.messageId === messageId));
        for (const receipt of pending) receipt.readAt = new Date();
        return pending.length;
      },
      listSent: async limit => [...store.messages].sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime()).slice(0, limit)
        .map(message => ({ ...structuredClone(message), readCount: store.receipts.filter(receipt => receipt.messageId === message.id && receipt.readAt).length }))
    },
    curricula: {
      async findReviewed(programme, track, yearGroup) {
        const matches = store.curricula.filter(c => c.programme === programme && c.track === track && c.yearGroup === yearGroup);
        return matches.length === 1 ? structuredClone({ version: matches[0].version, rules: matches[0].rules }) : undefined;
      }
    },
    students: {
      findById: async studentId => structuredClone(store.students.find(student => student.studentId === studentId)),
      searchByIdPrefix: async (prefix, limit) =>
        store.students.filter(student => student.studentId.startsWith(prefix)).slice(0, limit).map(student => structuredClone(student)),
      listCourses: async studentId => structuredClone(store.courses.get(studentId) ?? []),
      list: async filter => store.students
        .filter(student => (!filter.programme || student.programme === filter.programme) && (filter.yearGroup === undefined || student.yearGroup === filter.yearGroup))
        .sort((a, b) => a.studentId.localeCompare(b.studentId))
        .map(student => structuredClone(student)),
      async upsert(student) {
        const index = store.students.findIndex(existing => existing.studentId === student.studentId);
        if (index >= 0) store.students[index] = structuredClone(student);
        else store.students.push(structuredClone(student));
      },
      async remove(studentId) {
        store.students = store.students.filter(student => student.studentId !== studentId);
      },
      async setCourse(studentId, courseCode, attempts) {
        const others = (store.courses.get(studentId) ?? []).filter(course => course.courseCode !== courseCode);
        const next = attempts === null ? others : [...others, { courseCode, attempts: structuredClone(attempts) }];
        if (next.length) store.courses.set(studentId, next);
        else store.courses.delete(studentId);
      },
      async coursesFor(studentIds) {
        return new Map(studentIds.filter(id => (store.courses.get(id) ?? []).length > 0).map(id => [id, structuredClone(store.courses.get(id) ?? [])]));
      },
      async courseSummaries(studentIds) {
        const summaries: CourseSummary[] = [];
        for (const studentId of studentIds) {
          const latest = (store.courses.get(studentId) ?? []).map(course => course.attempts.at(-1)).filter(attempt => attempt !== undefined);
          if (latest.length === 0) continue;
          const sum = (attempts: typeof latest) => attempts.reduce((total, attempt) => total + attempt.credits, 0);
          const graded = latest.filter(attempt => attempt.status === 'COMPLETED' && attempt.grade !== undefined);
          summaries.push({
            studentId,
            coursesOnRecord: latest.length,
            passedCredits: sum(graded.filter(attempt => PROVISIONAL_PASSING_GRADES.includes(attempt.grade as string))),
            inProgressCredits: sum(latest.filter(attempt => attempt.status === 'ENROLLED')),
            unresolvedFailures: graded.filter(attempt => !PROVISIONAL_PASSING_GRADES.includes(attempt.grade as string)).length,
            incompletes: latest.filter(attempt => attempt.status === 'INCOMPLETE').length
          });
        }
        return summaries;
      }
    }
  };
  return { repositories, store };
}
