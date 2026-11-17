export const ROLES = ['STUDENT', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | 'student:read:own'
  | 'student:read:any'
  | 'user:reset-password'
  | 'audit-log:read'
  | 'curriculum:read'
  | 'curriculum:review'
  | 'report:read'
  | 'message:send'
  | 'message:read:own'
  | 'records:import'
  | 'settings:manage'
  | 'user:manage';

const rolePermissions: Record<Role, ReadonlySet<Permission>> = {
  STUDENT: new Set(['student:read:own', 'message:read:own']),
  ADMIN: new Set(['student:read:any', 'user:reset-password', 'audit-log:read', 'curriculum:read', 'curriculum:review', 'report:read', 'message:send', 'records:import', 'settings:manage', 'user:manage'])
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].has(permission);
}
