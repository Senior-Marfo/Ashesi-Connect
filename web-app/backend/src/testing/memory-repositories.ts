import { PROVISIONAL_PASSING_GRADES } from '../register/provisional-pass.js';
import type { AuditEntry, CourseRecord, CourseSummary, ReviewedCurriculum, RefreshTokenRecord, Repositories, StudentSummary, UserRecord } from '../repositories/types.js';

export interface MemoryStore {
  users: UserRecord[];
  refreshTokens: RefreshTokenRecord[];
  auditLog: AuditEntry[];
  students: StudentSummary[];
  courses: Map<string, CourseRecord[]>;
  curricula: Array<ReviewedCurriculum & { programme: string; track: string; yearGroup: number }>;
}

export function createMemoryRepositories(): { repositories: Repositories; store: MemoryStore } {
  const store: MemoryStore = { users: [], refreshTokens: [], auditLog: [], students: [], courses: new Map(), curricula: [] };
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
