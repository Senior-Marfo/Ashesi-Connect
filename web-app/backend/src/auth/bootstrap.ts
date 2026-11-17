import type { AppConfig } from '../config.js';
import type { UserRepository } from '../repositories/types.js';
import { hashPassword, passwordPolicyViolation } from './passwords.js';

/**
 * Creates the first administrator on a fresh database so a new deployment can be
 * signed into. Never overwrites an existing account, and the password must be
 * changed at first sign-in, so the seed value stops working once used.
 */
export async function ensureBootstrapAdmin(config: AppConfig, users: UserRepository): Promise<'created' | 'exists' | 'not-configured'> {
  const seed = config.bootstrapAdmin;
  if (!seed) return 'not-configured';
  if (!config.staffIdPattern.test(seed.identifier)) throw new Error('SEED_ADMIN_STAFF_ID does not match STAFF_ID_REGEX');
  const violation = passwordPolicyViolation(seed.password, seed.identifier);
  if (violation) throw new Error(`SEED_ADMIN_PASSWORD rejected: ${violation}`);
  const created = await users.createIfAbsent({
    identifier: seed.identifier,
    passwordHash: await hashPassword(seed.password),
    role: 'ADMIN',
    forcePasswordChange: true,
    failedLogins: 0
  });
  return created ? 'created' : 'exists';
}
