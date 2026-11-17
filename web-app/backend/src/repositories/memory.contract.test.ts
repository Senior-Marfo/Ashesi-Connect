import { createMemoryRepositories, type MemoryStore } from '../testing/memory-repositories.js';
import { repositoryContract } from './contract.js';
import type { Repositories } from './types.js';

let current: { repositories: Repositories; store: MemoryStore };

repositoryContract('in-memory', {
  repositories: () => current.repositories,
  async addCourses(studentId, courses) {
    current.store.courses.set(studentId, [...(current.store.courses.get(studentId) ?? []), ...courses]);
  },
  async addCurriculum(curriculum) {
    current.store.curricula.push({ ...structuredClone(curriculum), yearGroup: 2028 });
  },
  async reset() {
    current = createMemoryRepositories();
    current.store.users.push({ id: 'u1', identifier: '20280001', passwordHash: 'hash', role: 'STUDENT', studentId: '20280001', forcePasswordChange: false, failedLogins: 0 });
    current.store.students.push({ studentId: '20280001', fullName: 'Synthetic Student', programme: 'CS', yearGroup: 2028, track: 'standard' });
    current.store.courses.set('20280001', [{ courseCode: 'CS 111', attempts: [{ credits: 1, grade: 'B', status: 'COMPLETED', semester: '2024 Fall' }] }]);
    return 'u1';
  }
});
