import jwt from 'jsonwebtoken';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { isRole, type Role } from './permissions.js';

const ISSUER = 'ashesi-graduation-tracker';
const AUDIENCE = 'ashesi-api';

export interface AccessClaims {
  sub: string;
  role: Role;
  studentId?: string;
  passwordChangeRequired: boolean;
}

export function signAccessToken(claims: AccessClaims, secret: string, ttlSeconds: number): string {
  const { sub, ...payload } = claims;
  return jwt.sign(payload, secret, { subject: sub, expiresIn: ttlSeconds, issuer: ISSUER, audience: AUDIENCE, jwtid: randomUUID() });
}

export function verifyAccessToken(token: string, secret: string): AccessClaims | undefined {
  try {
    const claims = jwt.verify(token, secret, { issuer: ISSUER, audience: AUDIENCE, algorithms: ['HS256'] });
    if (typeof claims === 'string' || !claims.sub || !isRole(claims.role)) return undefined;
    return {
      sub: claims.sub,
      role: claims.role,
      studentId: typeof claims.studentId === 'string' ? claims.studentId : undefined,
      passwordChangeRequired: claims.passwordChangeRequired === true
    };
  } catch {
    return undefined;
  }
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
