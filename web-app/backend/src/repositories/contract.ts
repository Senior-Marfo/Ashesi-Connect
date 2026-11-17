import { beforeEach, describe, expect, it } from 'vitest';
import type { Repositories } from './types.js';

export interface ContractHarness {
  repositories: () => Repositories;
  /** Clears all data and inserts one student account, student record and course; returns the user's ID. */
  reset: () => Promise<string>;
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
