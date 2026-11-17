import { describe, expect, it } from 'vitest';
import { createMemoryRepositories } from '../testing/memory-repositories.js';
import { testConfig } from '../testing/fixtures.js';
import { ensureBootstrapAdmin } from './bootstrap.js';
import { verifyPassword } from './passwords.js';

describe('bootstrap administrator', () => {
  it('creates the admin once with a forced password change and never overwrites it', async () => {
    const { repositories, store } = createMemoryRepositories();
    const config = testConfig({ SEED_ADMIN_STAFF_ID: 'STF-0001', SEED_ADMIN_PASSWORD: 'First-Deploy-2026!' });
    expect(await ensureBootstrapAdmin(config, repositories.users)).toBe('created');
    expect(await ensureBootstrapAdmin(testConfig({ SEED_ADMIN_STAFF_ID: 'STF-0001', SEED_ADMIN_PASSWORD: 'Different-Pass-2026!' }), repositories.users)).toBe('exists');
    const admin = store.users[0];
    expect(admin).toMatchObject({ identifier: 'STF-0001', role: 'ADMIN', forcePasswordChange: true });
    expect(await verifyPassword(admin.passwordHash, 'First-Deploy-2026!')).toBe(true);
  });

  it('does nothing unless configured', async () => {
    const { repositories } = createMemoryRepositories();
    expect(await ensureBootstrapAdmin(testConfig(), repositories.users)).toBe('not-configured');
  });

  it('rejects weak passwords and IDs outside the staff format', async () => {
    const { repositories } = createMemoryRepositories();
    await expect(ensureBootstrapAdmin(testConfig({ SEED_ADMIN_STAFF_ID: 'STF-0001', SEED_ADMIN_PASSWORD: 'password' }), repositories.users)).rejects.toThrow('SEED_ADMIN_PASSWORD rejected');
    await expect(ensureBootstrapAdmin(testConfig({ SEED_ADMIN_STAFF_ID: 'admin', SEED_ADMIN_PASSWORD: 'First-Deploy-2026!' }), repositories.users)).rejects.toThrow('STAFF_ID_REGEX');
  });

  it('requires both seed variables together', () => {
    expect(() => testConfig({ SEED_ADMIN_STAFF_ID: 'STF-0001' })).toThrow('Set both');
  });
});
