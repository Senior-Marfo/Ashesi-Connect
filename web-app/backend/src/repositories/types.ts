import type { Role } from '../auth/permissions.js';

export interface UserRecord {
  id: string;
  identifier: string;
  passwordHash: string;
  role: Role;
  studentId?: string;
  forcePasswordChange: boolean;
  failedLogins: number;
  lockedUntil?: Date;
  passwordChangedAt?: Date;
}

export interface UserRepository {
  findByIdentifier(identifier: string): Promise<UserRecord | undefined>;
  findById(id: string): Promise<UserRecord | undefined>;
  update(id: string, changes: Partial<Omit<UserRecord, 'id' | 'identifier' | 'role'>>): Promise<void>;
  /** Inserts a user unless the identifier exists; resolves whether a user was created. */
  createIfAbsent(user: Omit<UserRecord, 'id'>): Promise<boolean>;
}

export interface RefreshTokenRecord {
  tokenHash: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedByHash?: string;
}

export interface RefreshTokenRepository {
  create(record: RefreshTokenRecord): Promise<void>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | undefined>;
  /** Atomically revokes an active token; resolves false if it was already revoked. */
  revoke(tokenHash: string, replacedByHash?: string): Promise<boolean>;
  revokeFamily(familyId: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

export type AuditAction =
  | 'AUTH_LOGIN_SUCCEEDED'
  | 'AUTH_LOGIN_FAILED'
  | 'AUTH_ACCOUNT_LOCKED'
  | 'AUTH_REFRESH_REUSE_DETECTED'
  | 'AUTH_LOGOUT'
  | 'AUTH_PASSWORD_CHANGED'
  | 'ADMIN_PASSWORD_RESET'
  | 'ADMIN_STUDENT_SEARCHED'
  | 'ADMIN_STUDENT_VIEWED'
  | 'ADMIN_AUDIT_LOG_VIEWED';

export interface AuditEntry {
  action: AuditAction;
  actorId?: string;
  actorRole?: Role;
  subject?: string;
  requestId?: string;
  ip?: string;
  metadata?: Record<string, string | number | boolean>;
  at: Date;
}

export interface AuditLogRepository {
  append(entry: AuditEntry): Promise<void>;
  list(options: { limit: number; action?: AuditAction }): Promise<AuditEntry[]>;
}

export interface StudentSummary {
  studentId: string;
  fullName: string;
  programme: string;
  yearGroup: number;
  track: string;
}

export interface CourseAttempt {
  credits: number;
  grade?: string;
  status: 'COMPLETED' | 'ENROLLED' | 'INCOMPLETE';
  semester?: string;
  attemptedAt?: Date;
}

export interface CourseRecord {
  courseCode: string;
  attempts: CourseAttempt[];
}

export interface StudentRepository {
  findById(studentId: string): Promise<StudentSummary | undefined>;
  searchByIdPrefix(prefix: string, limit: number): Promise<StudentSummary[]>;
  listCourses(studentId: string): Promise<CourseRecord[]>;
}

export interface Repositories {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  auditLog: AuditLogRepository;
  students: StudentRepository;
}
