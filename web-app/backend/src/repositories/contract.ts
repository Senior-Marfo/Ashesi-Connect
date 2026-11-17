import { beforeEach, describe, expect, it } from 'vitest';
import type { CourseRecord, Repositories } from './types.js';

export interface ContractHarness {
  repositories: () => Repositories;
  /** Clears all data and inserts one student account, student record and course; returns the user's ID. */
  reset: () => Promise<string>;
  addCourses: (studentId: string, courses: CourseRecord[]) => Promise<void>;
}

/** Behaviour every Repositories implementation must share; run against memory and MongoDB. */
export function repositoryContract(name: string, harness: ContractHarness) {
  describe(`${name} repositories`, () => {
    let userId: string;
    beforeEach(async () => { userId = await harness.reset(); });

    it('finds users by identifier and ID, and returns undefined for unknown or malformed IDs', async () => {
      const { users } = harness.repositories();
      const byIdentifier = await users.findByIdentifier('20280001');
      expect(byIdentifier).toMatchObject({ id: userId, role: 'STUDENT', studentId: '20280001', forcePasswordChange: false, failedLogins: 0 });
      expect(byIdentifier?.passwordHash).toBeTruthy();
      expect((await users.findById(userId))?.identifier).toBe('20280001');
      expect(await users.findByIdentifier('nobody')).toBeUndefined();
      expect(await users.findById('not-an-id')).toBeUndefined();
    });

    it('applies updates and clears fields set to undefined', async () => {
      const { users } = harness.repositories();
      const lockedUntil = new Date('2030-01-01T00:00:00Z');
      await users.update(userId, { failedLogins: 3, lockedUntil });
      expect(await users.findById(userId)).toMatchObject({ failedLogins: 3, lockedUntil });
      await users.update(userId, { failedLogins: 0, lockedUntil: undefined });
      const cleared = await users.findById(userId);
      expect(cleared?.failedLogins).toBe(0);
      expect(cleared?.lockedUntil).toBeUndefined();
    });

    it('creates a user only when the identifier is free', async () => {
      const { users } = harness.repositories();
      const admin = { identifier: 'STF-2001', passwordHash: 'h', role: 'ADMIN' as const, forcePasswordChange: true, failedLogins: 0 };
      expect(await users.createIfAbsent(admin)).toBe(true);
      expect(await users.createIfAbsent({ ...admin, passwordHash: 'other' })).toBe(false);
      expect(await users.findByIdentifier('STF-2001')).toMatchObject({ role: 'ADMIN', passwordHash: 'h', forcePasswordChange: true });
    });

    it('revokes a refresh token exactly once and revokes families and users', async () => {
      const { refreshTokens } = harness.repositories();
      const expiresAt = new Date(Date.now() + 60_000);
      await refreshTokens.create({ tokenHash: 'a', userId, familyId: 'f1', expiresAt });
      await refreshTokens.create({ tokenHash: 'b', userId, familyId: 'f1', expiresAt });
      await refreshTokens.create({ tokenHash: 'c', userId, familyId: 'f2', expiresAt });

      expect(await refreshTokens.revoke('a', 'b')).toBe(true);
      expect(await refreshTokens.revoke('a', 'b')).toBe(false);
      expect(await refreshTokens.findByHash('a')).toMatchObject({ replacedByHash: 'b', familyId: 'f1' });
      expect((await refreshTokens.findByHash('a'))?.revokedAt).toBeInstanceOf(Date);

      await refreshTokens.revokeFamily('f1');
      expect((await refreshTokens.findByHash('b'))?.revokedAt).toBeInstanceOf(Date);
      expect((await refreshTokens.findByHash('c'))?.revokedAt).toBeUndefined();

      await refreshTokens.revokeAllForUser(userId);
      expect((await refreshTokens.findByHash('c'))?.revokedAt).toBeInstanceOf(Date);
      expect(await refreshTokens.findByHash('missing')).toBeUndefined();
    });

    it('lists audit entries newest first, filtered by action', async () => {
      const { auditLog } = harness.repositories();
      await auditLog.append({ action: 'AUTH_LOGIN_SUCCEEDED', subject: '20280001', at: new Date('2026-01-01T00:00:00Z') });
      await auditLog.append({ action: 'ADMIN_STUDENT_VIEWED', subject: '20280001', metadata: { source: 'test' }, at: new Date('2026-01-02T00:00:00Z') });
      const all = await auditLog.list({ limit: 10 });
      expect(all.map(entry => entry.action)).toEqual(['ADMIN_STUDENT_VIEWED', 'AUTH_LOGIN_SUCCEEDED']);
      expect(all[0].metadata).toEqual({ source: 'test' });
      expect(await auditLog.list({ limit: 10, action: 'AUTH_LOGIN_SUCCEEDED' })).toHaveLength(1);
      expect(await auditLog.list({ limit: 1 })).toHaveLength(1);
    });

    it('lists students by programme and year group', async () => {
      const { students } = harness.repositories();
      expect((await students.list({})).map(student => student.studentId)).toEqual(['20280001']);
      expect(await students.list({ programme: 'CS', yearGroup: 2028 })).toHaveLength(1);
      expect(await students.list({ programme: 'BA' })).toHaveLength(0);
      expect(await students.list({ yearGroup: 2027 })).toHaveLength(0);
    });

    it('summarises each student from the latest attempt at every course', async () => {
      const { students } = harness.repositories();
      await harness.addCourses('20280001', [
        { courseCode: 'MATH 141', attempts: [{ credits: 1, grade: 'E', status: 'COMPLETED' }, { credits: 1, grade: 'C', status: 'COMPLETED' }] },
        { courseCode: 'CS 212', attempts: [{ credits: 1, grade: 'D', status: 'COMPLETED' }] },
        { courseCode: 'LEAD 111', attempts: [{ credits: 0.5, grade: 'D+', status: 'COMPLETED' }] },
        { courseCode: 'CS 415', attempts: [{ credits: 1, status: 'ENROLLED' }] },
        { courseCode: 'ECON 101', attempts: [{ credits: 1, status: 'INCOMPLETE' }] }
      ]);
      expect(await students.courseSummaries(['20280001', 'nobody'])).toEqual([{
        studentId: '20280001', coursesOnRecord: 6, passedCredits: 2.5, inProgressCredits: 1, unresolvedFailures: 1, incompletes: 1
      }]);
      expect(await students.courseSummaries([])).toEqual([]);
    });

    it('loads course records for several students at once', async () => {
      const { students } = harness.repositories();
      const courses = await students.coursesFor(['20280001', 'nobody']);
      expect([...courses.keys()]).toEqual(['20280001']);
      expect(courses.get('20280001')).toEqual([{ courseCode: 'CS 111', attempts: [{ credits: 1, grade: 'B', status: 'COMPLETED', semester: '2024 Fall' }] }]);
      expect((await students.coursesFor([])).size).toBe(0);
    });

    it('delivers messages to each recipient and tracks reads per student', async () => {
      const { messages } = harness.repositories();
      const first = await messages.send({ title: 'Audit review', body: 'Check your record.', priority: 'NORMAL', audience: { kind: 'ALL_STUDENTS' }, senderId: 'admin', sentAt: new Date('2026-11-01T00:00:00Z') }, ['20280001', '20280002']);
      const second = await messages.send({ title: 'Retake', body: 'Register for MATH 141.', priority: 'HIGH', audience: { kind: 'STUDENTS', studentIds: ['20280001'] }, senderId: 'admin', sentAt: new Date('2026-11-02T00:00:00Z') }, ['20280001']);
      expect(first.recipientCount).toBe(2);

      const inbox = await messages.inbox('20280001', 10);
      expect(inbox.map(item => item.title)).toEqual(['Retake', 'Audit review']);
      expect(inbox[0]).toMatchObject({ id: second.id, priority: 'HIGH' });
      expect(inbox[0].readAt).toBeUndefined();
      expect(await messages.unreadCount('20280001')).toBe(2);

      expect(await messages.markRead('20280001', second.id)).toBe(1);
      expect(await messages.markRead('20280001', second.id)).toBe(0);
      expect(await messages.unreadCount('20280001')).toBe(1);
      expect(await messages.markRead('20280001')).toBe(1);
      expect(await messages.unreadCount('20280001')).toBe(0);
      expect(await messages.unreadCount('20280002')).toBe(1);
      expect(await messages.inbox('nobody', 10)).toEqual([]);

      const sent = await messages.listSent(10);
      expect(sent.map(message => [message.title, message.recipientCount, message.readCount])).toEqual([['Retake', 1, 1], ['Audit review', 2, 1]]);
      expect(sent[1].audience).toEqual({ kind: 'ALL_STUDENTS' });
    });

    it('writes, replaces and removes students, courses and accounts', async () => {
      const { students, users } = harness.repositories();
      await students.upsert({ studentId: '20290001', fullName: 'New', programme: 'BA', yearGroup: 2029, track: 'standard' });
      await students.upsert({ studentId: '20280001', fullName: 'Renamed', programme: 'CS', yearGroup: 2028, track: 'standard' });
      expect(await students.findById('20290001')).toEqual({ studentId: '20290001', fullName: 'New', programme: 'BA', yearGroup: 2029, track: 'standard' });
      expect((await students.findById('20280001'))?.fullName).toBe('Renamed');
      await students.setCourse('20290001', 'BUSA 161', [{ credits: 1, grade: 'A', status: 'COMPLETED', semester: '2025 Fall' }]);
      await students.setCourse('20280001', 'CS 111', [{ credits: 1, grade: 'C', status: 'COMPLETED' }]);
      expect((await students.listCourses('20290001')).map(c => c.courseCode)).toEqual(['BUSA 161']);
      expect((await students.listCourses('20280001'))[0].attempts[0].grade).toBe('C');
      await students.setCourse('20290001', 'BUSA 161', null);
      expect(await students.listCourses('20290001')).toEqual([]);
      await students.remove('20290001');
      expect(await students.findById('20290001')).toBeUndefined();
      await users.removeByIdentifier('20280001');
      expect(await users.findByIdentifier('20280001')).toBeUndefined();
    });

    it('records import batches, newest first, and tracks undo', async () => {
      const { imports } = harness.repositories();
      const base = { kind: 'STUDENTS' as const, filename: 'a.csv', createdBy: 'admin', rows: 1, created: 1, updated: 0, status: 'APPLIED' as const };
      const first = await imports.create({ ...base, createdAt: new Date('2026-11-01T00:00:00Z'), undo: [{ type: 'account', identifier: '1' }] });
      const second = await imports.create({ ...base, filename: 'b.csv', createdAt: new Date('2026-11-02T00:00:00Z'), undo: [] });
      expect((await imports.list(10)).map(batch => batch.filename)).toEqual(['b.csv', 'a.csv']);
      expect((await imports.find(first.id))?.undo).toEqual([{ type: 'account', identifier: '1' }]);
      expect((await imports.latestApplied())?.id).toBe(second.id);
      await imports.markRolledBack(second.id, new Date('2026-11-03T00:00:00Z'));
      expect((await imports.latestApplied())?.id).toBe(first.id);
      expect((await imports.find(second.id))?.status).toBe('ROLLED_BACK');
      expect(await imports.find('missing')).toBeUndefined();
    });

    it('stores settings over the defaults and lists accounts by role', async () => {
      const { settings, users } = harness.repositories();
      expect((await settings.get()).standing).toEqual({ normalLoad: 5, maxLoad: 6, criticalFailedCourses: 3 });
      await settings.update({ standing: { normalLoad: 4, maxLoad: 5.5, criticalFailedCourses: 2 }, updatedAt: new Date('2026-11-17T00:00:00Z'), updatedBy: 'admin' });
      expect(await settings.get()).toEqual({ standing: { normalLoad: 4, maxLoad: 5.5, criticalFailedCourses: 2 }, updatedAt: new Date('2026-11-17T00:00:00Z'), updatedBy: 'admin' });
      await users.createIfAbsent({ identifier: 'STF-3003', passwordHash: 'h', role: 'ADMIN', forcePasswordChange: true, failedLogins: 0 });
      expect((await users.listByRole('ADMIN')).map(user => [user.identifier, user.forcePasswordChange])).toEqual([['STF-3003', true]]);
      expect((await users.listByRole('STUDENT')).map(user => user.identifier)).toEqual(['20280001']);
    });

    it('keeps staff notes per student, newest first', async () => {
      const { notes } = harness.repositories();
      const first = await notes.add({ studentId: '20280001', body: 'Discussed MATH 141 retake.', authorId: 'admin', createdAt: new Date('2026-11-01T00:00:00Z') });
      await notes.add({ studentId: '20280001', body: 'Capstone supervisor confirmed.', authorId: 'admin', createdAt: new Date('2026-11-02T00:00:00Z') });
      await notes.add({ studentId: '20280002', body: 'Other student.', authorId: 'admin', createdAt: new Date('2026-11-03T00:00:00Z') });
      expect(first.id).toBeTruthy();
      const listed = await notes.listFor('20280001', 10);
      expect(listed.map(note => note.body)).toEqual(['Capstone supervisor confirmed.', 'Discussed MATH 141 retake.']);
      expect(listed[1]).toEqual(first);
      expect(await notes.listFor('20280001', 1)).toHaveLength(1);
      expect(await notes.listFor('nobody', 10)).toEqual([]);
    });

    it('reads students and courses, treating search input literally', async () => {
      const { students } = harness.repositories();
      expect(await students.findById('20280001')).toEqual({ studentId: '20280001', fullName: 'Synthetic Student', programme: 'CS', yearGroup: 2028, track: 'standard' });
      expect(await students.findById('missing')).toBeUndefined();
      expect(await students.searchByIdPrefix('2028', 10)).toHaveLength(1);
      expect(await students.searchByIdPrefix('.*', 10)).toHaveLength(0);
      expect(await students.listCourses('20280001')).toEqual([{ courseCode: 'CS 111', attempts: [{ credits: 1, grade: 'B', status: 'COMPLETED', semester: '2024 Fall' }] }]);
      expect(await students.listCourses('missing')).toEqual([]);
    });
  });
}
