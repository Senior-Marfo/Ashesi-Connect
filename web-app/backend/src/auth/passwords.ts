import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

const MIN_LENGTH = 12;
const MAX_LENGTH = 256;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password).catch(() => false);
}

export function passwordPolicyViolation(password: string, identifier: string): string | undefined {
  if (password.length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters`;
  if (password.length > MAX_LENGTH) return `Password must be at most ${MAX_LENGTH} characters`;
  if (password.toLowerCase().includes(identifier.toLowerCase())) return 'Password must not contain your ID';
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(pattern => pattern.test(password)).length;
  if (classes < 3) return 'Password must mix at least three of: lowercase, uppercase, digits, symbols';
  return undefined;
}

export function generateTemporaryPassword(): string {
  return `Tmp-${randomBytes(12).toString('base64url')}9a`;
}
