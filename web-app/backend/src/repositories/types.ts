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
  removeByIdentifier(identifier: string): Promise<void>;
  listByRole(role: Role): Promise<Array<Pick<UserRecord, 'id' | 'identifier' | 'forcePasswordChange' | 'lockedUntil'>>>;
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
  | 'ADMIN_AUDIT_LOG_VIEWED'
  | 'ADMIN_REGISTER_VIEWED'
  | 'ADMIN_ELIGIBILITY_VIEWED'
  | 'ADMIN_REPORTS_VIEWED'
  | 'ADMIN_MESSAGE_SENT'
  | 'ADMIN_IMPORT_APPLIED'
  | 'ADMIN_IMPORT_ROLLED_BACK'
  | 'ADMIN_SETTINGS_UPDATED'
  | 'ADMIN_USER_CREATED'
  | 'ADMIN_REGISTER_EXPORTED';

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
  synthetic?: boolean;
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

export interface StudentFilter {
  programme?: string;
  yearGroup?: number;
}

/** Facts derived from a student's latest attempt at each course, using the provisional pass mark. */
export interface CourseSummary {
  studentId: string;
  coursesOnRecord: number;
  passedCredits: number;
  inProgressCredits: number;
  unresolvedFailures: number;
  incompletes: number;
}

export interface StudentRepository {
  findById(studentId: string): Promise<StudentSummary | undefined>;
  searchByIdPrefix(prefix: string, limit: number): Promise<StudentSummary[]>;
  listCourses(studentId: string): Promise<CourseRecord[]>;
  list(filter: StudentFilter): Promise<StudentSummary[]>;
  /** Summaries for students that have course records; students without any are omitted. */
  courseSummaries(studentIds: string[]): Promise<CourseSummary[]>;
  /** Course records for many students at once; students without records are omitted. */
  coursesFor(studentIds: string[]): Promise<Map<string, CourseRecord[]>>;
  /** Creates or replaces a student's details. */
  upsert(student: StudentSummary): Promise<void>;
  remove(studentId: string): Promise<void>;
  /** Replaces a student's attempts at one course; null removes the course record. */
  setCourse(studentId: string, courseCode: string, attempts: CourseAttempt[] | null): Promise<void>;
}

export interface ReviewedCurriculum {
  version: string;
  rules: import('../domain/eligibility/programme-audit.js').ProgrammeRules;
}

export interface CurriculumRepository {
  /** The single Registry-reviewed, issue-free curriculum for this programme, track and cohort, if any. */
  findReviewed(programme: string, track: string, yearGroup: number): Promise<ReviewedCurriculum | undefined>;
}

export type MessagePriority = 'NORMAL' | 'HIGH';
export type MessageAudience =
  | { kind: 'ALL_STUDENTS' }
  | { kind: 'PROGRAMME'; programme: string }
  | { kind: 'YEAR_GROUP'; yearGroup: number }
  | { kind: 'STANDING'; standing: 'RED' | 'YELLOW' | 'GREEN' }
  | { kind: 'STUDENTS'; studentIds: string[] };

export interface MessageRecord {
  id: string;
  title: string;
  body: string;
  priority: MessagePriority;
  audience: MessageAudience;
  senderId: string;
  sentAt: Date;
  recipientCount: number;
}

export interface InboxItem {
  id: string;
  title: string;
  body: string;
  priority: MessagePriority;
  sentAt: Date;
  readAt?: Date;
}

export interface MessageRepository {
  /** Stores the message and one receipt per recipient (delivery to the in-app inbox). */
  send(message: Omit<MessageRecord, 'id' | 'recipientCount'>, recipientIds: string[]): Promise<MessageRecord>;
  inbox(studentId: string, limit: number): Promise<InboxItem[]>;
  unreadCount(studentId: string): Promise<number>;
  /** Marks one message, or every message when no ID is given, as read; returns how many changed. */
  markRead(studentId: string, messageId?: string): Promise<number>;
  listSent(limit: number): Promise<Array<MessageRecord & { readCount: number }>>;
}

export type ImportKind = 'STUDENTS' | 'COURSES';
export type UndoStep =
  | { type: 'student'; studentId: string; before: StudentSummary | null }
  | { type: 'course'; studentId: string; courseCode: string; before: CourseAttempt[] | null }
  | { type: 'account'; identifier: string };

export interface ImportBatch {
  id: string;
  kind: ImportKind;
  filename: string;
  createdBy: string;
  createdAt: Date;
  rows: number;
  created: number;
  updated: number;
  status: 'APPLIED' | 'ROLLED_BACK';
  rolledBackAt?: Date;
  /** What each change replaced, applied in reverse to undo the batch. */
  undo: UndoStep[];
}

export interface ImportRepository {
  create(batch: Omit<ImportBatch, 'id'>): Promise<ImportBatch>;
  list(limit: number): Promise<Array<Omit<ImportBatch, 'undo'>>>;
  find(id: string): Promise<ImportBatch | undefined>;
  /** The most recent batch that is still applied. */
  latestApplied(): Promise<ImportBatch | undefined>;
  markRolledBack(id: string, at: Date): Promise<void>;
}

export interface AppSettings {
  standing: import('../domain/eligibility/standing.js').StandingConfig;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface SettingsRepository {
  get(): Promise<AppSettings>;
  update(settings: AppSettings): Promise<void>;
}

export interface Repositories {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  auditLog: AuditLogRepository;
  students: StudentRepository;
  curricula: CurriculumRepository;
  messages: MessageRepository;
  imports: ImportRepository;
  settings: SettingsRepository;
}
