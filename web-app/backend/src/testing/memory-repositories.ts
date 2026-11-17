import type { AuditEntry, CourseRecord, RefreshTokenRecord, Repositories, StudentSummary, UserRecord } from '../repositories/types.js';

export interface MemoryStore {
  users: UserRecord[];
  refreshTokens: RefreshTokenRecord[];
  auditLog: AuditEntry[];
  students: StudentSummary[];
  courses: Map<string, CourseRecord[]>;
}

export function createMemoryRepositories(): { repositories: Repositories; store: MemoryStore } {
  const store: MemoryStore = { users: [], refreshTokens: [], auditLog: [], students: [], courses: new Map() };
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
    students: {
      findById: async studentId => structuredClone(store.students.find(student => student.studentId === studentId)),
      searchByIdPrefix: async (prefix, limit) =>
        store.students.filter(student => student.studentId.startsWith(prefix)).slice(0, limit).map(student => structuredClone(student)),
      listCourses: async studentId => structuredClone(store.courses.get(studentId) ?? [])
    }
  };
  return { repositories, store };
}
