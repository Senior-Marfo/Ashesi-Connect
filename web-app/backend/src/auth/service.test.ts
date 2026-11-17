import { describe, expect, it } from 'vitest';
import { createMemoryRepositories } from '../testing/memory-repositories.js';
import { testConfig } from '../testing/fixtures.js';
import { hashPassword, passwordPolicyViolation } from './passwords.js';
import { AuthService } from './service.js';

async function serviceAt(clock: { now: Date }) {
  const { repositories, store } = createMemoryRepositories();
  store.users.push({ id: 'u1', identifier: '20260001', passwordHash: await hashPassword('Correct-Horse-42'), role: 'STUDENT', studentId: '20260001', forcePasswordChange: false, failedLogins: 0 });
  const service = new AuthService({ config: testConfig({ REFRESH_TOKEN_TTL: '60', LOCKOUT_THRESHOLD: '2', LOCKOUT_MINUTES: '1' }), ...repositories, now: () => clock.now });
  return { service, store };
}

describe('AuthService timing rules', () => {
  it('rejects an expired refresh token', async () => {
    const clock = { now: new Date('2026-01-01T00:00:00Z') };
    const { service } = await serviceAt(clock);
    const session = await service.login('20260001', 'Correct-Horse-42', {});
    clock.now = new Date('2026-01-01T00:01:01Z');
    await expect(service.refresh(session.refreshToken, {})).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('unlocks the account once the lockout period passes', async () => {
    const clock = { now: new Date('2026-01-01T00:00:00Z') };
    const { service } = await serviceAt(clock);
    await expect(service.login('20260001', 'nope', {})).rejects.toThrow();
    await expect(service.login('20260001', 'nope', {})).rejects.toThrow();
    await expect(service.login('20260001', 'Correct-Horse-42', {})).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    clock.now = new Date('2026-01-01T00:01:01Z');
    await expect(service.login('20260001', 'Correct-Horse-42', {})).resolves.toMatchObject({ role: 'STUDENT' });
  });

  it('rejects concurrent use of the same refresh token', async () => {
    const clock = { now: new Date('2026-01-01T00:00:00Z') };
    const { service } = await serviceAt(clock);
    const session = await service.login('20260001', 'Correct-Horse-42', {});
    const results = await Promise.allSettled([service.refresh(session.refreshToken, {}), service.refresh(session.refreshToken, {})]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  });
});

describe('password policy', () => {
  it.each([
    ['short', 'at least 12'],
    ['abcdefghijklmnop', 'three of'],
    ['My-20260001-Password', 'must not contain your ID']
  ])('rejects %s', (password, message) => {
    expect(passwordPolicyViolation(password, '20260001')).toContain(message);
  });

  it('accepts a long mixed password', () => {
    expect(passwordPolicyViolation('Fresh-Start-2028!', '20260001')).toBeUndefined();
  });
});
