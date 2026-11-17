import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../config.js';
import type { AuditLogRepository, RefreshTokenRepository, UserRecord, UserRepository } from '../repositories/types.js';
import { generateTemporaryPassword, hashPassword, passwordPolicyViolation, verifyPassword } from './passwords.js';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from './tokens.js';
import type { Role } from './permissions.js';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  role: Role;
  passwordChangeRequired: boolean;
}

export interface RequestContext {
  requestId?: string;
  ip?: string;
}

export class AuthError extends Error {
  constructor(readonly code: 'INVALID_CREDENTIALS' | 'INVALID_REFRESH_TOKEN' | 'WEAK_PASSWORD' | 'USER_NOT_FOUND', message: string = code) {
    super(message);
  }
}

// Verified against when an identifier is unknown so response timing does not reveal which IDs exist.
const DUMMY_HASH_PROMISE = hashPassword(randomUUID());

interface Dependencies {
  config: AppConfig;
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  auditLog: AuditLogRepository;
  now?: () => Date;
}

export class AuthService {
  private readonly now: () => Date;

  constructor(private readonly deps: Dependencies) {
    this.now = deps.now ?? (() => new Date());
  }

  /** Resolves the role from the stored account; the client never supplies it. */
  async login(identifier: string, password: string, context: RequestContext): Promise<SessionTokens> {
    const normalised = identifier.trim();
    const recognisedFormat = this.deps.config.studentIdPattern.test(normalised) || this.deps.config.staffIdPattern.test(normalised);
    const user = recognisedFormat ? await this.deps.users.findByIdentifier(normalised) : undefined;

    if (!user) {
      await verifyPassword(await DUMMY_HASH_PROMISE, password);
      await this.audit('AUTH_LOGIN_FAILED', context, { subject: normalised, metadata: { reason: 'UNKNOWN_ACCOUNT' } });
      throw new AuthError('INVALID_CREDENTIALS');
    }
    if (user.lockedUntil && user.lockedUntil > this.now()) {
      await this.audit('AUTH_LOGIN_FAILED', context, { subject: user.identifier, metadata: { reason: 'LOCKED' } });
      throw new AuthError('INVALID_CREDENTIALS');
    }
    if (!(await verifyPassword(user.passwordHash, password))) {
      await this.recordFailedLogin(user, context);
      throw new AuthError('INVALID_CREDENTIALS');
    }

    await this.deps.users.update(user.id, { failedLogins: 0, lockedUntil: undefined });
    await this.audit('AUTH_LOGIN_SUCCEEDED', context, { actor: user, subject: user.identifier });
    return this.issueSession(user, randomUUID());
  }

  /**
   * Rotates a refresh token. Presenting a token that was already rotated means it
   * has leaked, so the whole token family is revoked and the user must sign in again.
   */
  async refresh(refreshToken: string, context: RequestContext): Promise<SessionTokens> {
    const record = await this.deps.refreshTokens.findByHash(hashRefreshToken(refreshToken));
    if (!record) throw new AuthError('INVALID_REFRESH_TOKEN');

    if (record.revokedAt) {
      if (record.replacedByHash) {
        await this.deps.refreshTokens.revokeFamily(record.familyId);
        await this.audit('AUTH_REFRESH_REUSE_DETECTED', context, { subject: record.userId, metadata: { familyId: record.familyId } });
      }
      throw new AuthError('INVALID_REFRESH_TOKEN');
    }
    if (record.expiresAt <= this.now()) throw new AuthError('INVALID_REFRESH_TOKEN');

    const user = await this.deps.users.findById(record.userId);
    if (!user) throw new AuthError('INVALID_REFRESH_TOKEN');

    const next = generateRefreshToken();
    const rotated = await this.deps.refreshTokens.revoke(record.tokenHash, hashRefreshToken(next));
    if (!rotated) {
      await this.deps.refreshTokens.revokeFamily(record.familyId);
      await this.audit('AUTH_REFRESH_REUSE_DETECTED', context, { subject: record.userId, metadata: { familyId: record.familyId } });
      throw new AuthError('INVALID_REFRESH_TOKEN');
    }
    return this.issueSession(user, record.familyId, next);
  }

  async logout(refreshToken: string | undefined, context: RequestContext): Promise<void> {
    if (!refreshToken) return;
    const record = await this.deps.refreshTokens.findByHash(hashRefreshToken(refreshToken));
    if (!record) return;
    await this.deps.refreshTokens.revokeFamily(record.familyId);
    await this.audit('AUTH_LOGOUT', context, { subject: record.userId });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, context: RequestContext): Promise<SessionTokens> {
    const user = await this.deps.users.findById(userId);
    if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) throw new AuthError('INVALID_CREDENTIALS');
    const violation = passwordPolicyViolation(newPassword, user.identifier);
    if (violation) throw new AuthError('WEAK_PASSWORD', violation);
    if (await verifyPassword(user.passwordHash, newPassword)) throw new AuthError('WEAK_PASSWORD', 'New password must differ from the current password');

    const changes = { passwordHash: await hashPassword(newPassword), forcePasswordChange: false, passwordChangedAt: this.now() };
    await this.deps.users.update(user.id, changes);
    await this.deps.refreshTokens.revokeAllForUser(user.id);
    await this.audit('AUTH_PASSWORD_CHANGED', context, { actor: user, subject: user.identifier });
    return this.issueSession({ ...user, ...changes }, randomUUID());
  }

  /** Admin-triggered reset: returns a one-time temporary password the user must replace on next sign-in. */
  async resetPassword(admin: { id: string; role: Role }, targetIdentifier: string, context: RequestContext): Promise<string> {
    const target = await this.deps.users.findByIdentifier(targetIdentifier.trim());
    if (!target) throw new AuthError('USER_NOT_FOUND');
    const temporaryPassword = generateTemporaryPassword();
    await this.deps.users.update(target.id, {
      passwordHash: await hashPassword(temporaryPassword),
      forcePasswordChange: true,
      failedLogins: 0,
      lockedUntil: undefined
    });
    await this.deps.refreshTokens.revokeAllForUser(target.id);
    await this.deps.auditLog.append({
      action: 'ADMIN_PASSWORD_RESET', actorId: admin.id, actorRole: admin.role, subject: target.identifier,
      requestId: context.requestId, ip: context.ip, at: this.now()
    });
    return temporaryPassword;
  }

  private async recordFailedLogin(user: UserRecord, context: RequestContext): Promise<void> {
    const failedLogins = user.failedLogins + 1;
    const { threshold, durationMs } = this.deps.config.lockout;
    const locks = failedLogins >= threshold;
    await this.deps.users.update(user.id, locks
      ? { failedLogins: 0, lockedUntil: new Date(this.now().getTime() + durationMs) }
      : { failedLogins });
    await this.audit(locks ? 'AUTH_ACCOUNT_LOCKED' : 'AUTH_LOGIN_FAILED', context, { subject: user.identifier, metadata: { reason: 'BAD_PASSWORD' } });
  }

  private async issueSession(user: UserRecord, familyId: string, refreshToken = generateRefreshToken()): Promise<SessionTokens> {
    const { accessTokenSecret, accessTokenTtlSeconds, refreshTokenTtlSeconds } = this.deps.config;
    const refreshExpiresAt = new Date(this.now().getTime() + refreshTokenTtlSeconds * 1000);
    await this.deps.refreshTokens.create({ tokenHash: hashRefreshToken(refreshToken), userId: user.id, familyId, expiresAt: refreshExpiresAt });
    const accessToken = signAccessToken(
      { sub: user.id, role: user.role, studentId: user.studentId, passwordChangeRequired: user.forcePasswordChange },
      accessTokenSecret,
      accessTokenTtlSeconds
    );
    return { accessToken, refreshToken, refreshExpiresAt, role: user.role, passwordChangeRequired: user.forcePasswordChange };
  }

  private audit(
    action: 'AUTH_LOGIN_SUCCEEDED' | 'AUTH_LOGIN_FAILED' | 'AUTH_ACCOUNT_LOCKED' | 'AUTH_REFRESH_REUSE_DETECTED' | 'AUTH_LOGOUT' | 'AUTH_PASSWORD_CHANGED',
    context: RequestContext,
    details: { actor?: UserRecord; subject?: string; metadata?: Record<string, string> }
  ): Promise<void> {
    return this.deps.auditLog.append({
      action,
      actorId: details.actor?.id,
      actorRole: details.actor?.role,
      subject: details.subject,
      requestId: context.requestId,
      ip: context.ip,
      metadata: details.metadata,
      at: this.now()
    });
  }
}
