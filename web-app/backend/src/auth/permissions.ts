export const ROLES = ['STUDENT', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | 'student:read:own'
  | 'student:read:any'
  | 'user:reset-password'
  | 'audit-log:read';

const rolePermissions: Record<Role, ReadonlySet<Permission>> = {
  STUDENT: new Set(['student:read:own']),
  ADMIN: new Set(['student:read:any', 'user:reset-password', 'audit-log:read'])
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].has(permission);
}
