export type Role = 'STUDENT' | 'ADMIN';

export interface Session {
  role: Role;
  passwordChangeRequired: boolean;
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
}

export interface CourseRecord {
  courseCode: string;
  attempts: CourseAttempt[];
}

export interface StudentRecord {
  student: StudentSummary;
  courses: CourseRecord[];
}

export type RemainingReason = 'NOT_TAKEN' | 'FAILED' | 'IN_PROGRESS' | 'INCOMPLETE' | 'ELECTIVE_SLOT_OPEN' | 'AFRICAN_STUDIES_MISSING' | 'CREDIT_SHORTFALL';

export interface CurriculumSummary {
  programme: string;
  track: string;
  version: string;
  status: 'DRAFT' | 'REVIEWED' | 'SUPERSEDED';
  validationIssues: string[];
  updatedAt?: string;
}

export type StandingLevel = 'GREEN' | 'YELLOW' | 'RED';
export type StandingReason =
  | 'REQUIREMENTS_MET' | 'ON_TRACK' | 'FAILED_COURSE_TO_RETAKE' | 'INCOMPLETE_TO_RESOLVE' | 'HEAVY_LOAD_NEEDED'
  | 'MULTIPLE_FAILED_COURSES' | 'CANNOT_FINISH_IN_TIME' | 'PAST_EXPECTED_GRADUATION';
export type RequirementState = 'COMPLETED' | 'IN_PROGRESS' | 'FAILED' | 'INCOMPLETE' | 'NOT_STARTED';

export interface RequirementItem { code: string; credits: number; minimumGrade: string; state: RequirementState; grade?: string; attempts: number }
export interface RequirementGroup {
  category: string;
  kind: 'REQUIRED' | 'ELECTIVE';
  creditsRequired: number;
  creditsCompleted: number;
  creditsInProgress: number;
  items: RequirementItem[];
  options: string[];
}

export interface Standing {
  level: StandingLevel;
  reasons: StandingReason[];
  creditsOutstanding: number;
  termsRemaining: number;
  creditsPerTermNeeded: number | null;
}

export interface NextAction { kind: 'RETAKE' | 'RESOLVE_INCOMPLETE' | 'TAKE_COURSE' | 'CHOOSE_ELECTIVE'; code: string; category: string; credits: number }

/** Advisory only: never an official audit, graduation approval or Registry certification. */
export interface Eligibility {
  student: StudentSummary;
  officialCertification: false;
  status: 'NO_CURRICULUM' | 'DATA_ISSUES' | 'REQUIREMENTS_MET' | 'REQUIREMENTS_REMAINING';
  curriculum: { basis: 'REVIEWED' | 'SYNTHETIC'; version: string } | null;
  expectedGraduation: string;
  audit: null | {
    creditsEarned: number;
    creditsRequired: number;
    creditsInProgress: number;
    percentComplete: number;
    remainingRequirements: Array<{ code: string; category: string; credits: number; reason: RemainingReason }>;
  };
  standing: Standing | null;
  requirements: RequirementGroup[];
  nextActions: NextAction[];
  issues: string[];
}

export type MessagePriority = 'NORMAL' | 'HIGH';
export type MessageAudience =
  | { kind: 'ALL_STUDENTS' }
  | { kind: 'PROGRAMME'; programme: string }
  | { kind: 'YEAR_GROUP'; yearGroup: number }
  | { kind: 'STANDING'; standing: StandingLevel }
  | { kind: 'STUDENTS'; studentIds: string[] };
export interface InboxItem { id: string; title: string; body: string; priority: MessagePriority; sentAt: string; readAt?: string }
export interface SentMessage { id: string; title: string; body: string; priority: MessagePriority; audience: MessageAudience; sentAt: string; recipientCount: number; readCount: number }
export interface MessageTemplate { id: string; title: string; body: string; priority: MessagePriority }
export interface NewMessage { title: string; body: string; priority: MessagePriority; audience: MessageAudience }

export type ImportKind = 'STUDENTS' | 'COURSES';
export interface ImportPreview { kind: ImportKind; rows: number; created: number; updated: number; errorCount: number; errors: Array<{ row: number; column?: string; message: string }> }
export interface ImportBatch { id: string; kind: ImportKind; filename: string; createdAt: string; rows: number; created: number; updated: number; status: 'APPLIED' | 'ROLLED_BACK'; rolledBackAt?: string; canUndo?: boolean }
export interface ImportUpload { kind: ImportKind; filename: string; content: string }

export type StandingCounts = Record<StandingLevel | 'UNDETERMINED', number>;
export const NON_COMPLETION_REASONS = ['FAILED_COURSE', 'INCOMPLETE_COURSE', 'REQUIRED_COURSE_NOT_TAKEN', 'CAPSTONE_OUTSTANDING', 'ELECTIVES_SHORT', 'CREDIT_SHORTFALL', 'STILL_IN_PROGRESS'] as const;
export type NonCompletionReason = (typeof NON_COMPLETION_REASONS)[number];
export const GRADE_SCALE = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E'] as const;

export interface ReportFilters { programme?: string; yearGroup?: number }
export interface Reports {
  generatedAt: string;
  totals: { students: number; assessed: number; graduatedCohorts: number[] };
  standings: StandingCounts;
  cohortOutcomes: Array<{ yearGroup: number; students: number; assessed: number; requirementsMet: number; completionRate: number | null; reasons: Record<NonCompletionReason, number> }>;
  cohortProgress: Array<{ yearGroup: number; students: number; assessed: number; averagePercentComplete: number | null; standings: StandingCounts }>;
  programmes: Array<{ programme: string; students: number; averagePassedCredits: number; completionRate: number | null; standings: StandingCounts }>;
  courses: Array<{ courseCode: string; students: number; attempts: number; firstAttemptPassRate: number | null; unresolvedFailures: number; retakes: number; grades: Record<(typeof GRADE_SCALE)[number], number> }>;
}

export type RegisterFlag = 'UNRESOLVED_FAILURE' | 'INCOMPLETE' | 'NO_RECORDS';
export type RegisterSort = 'studentId' | 'fullName' | 'programme' | 'yearGroup' | 'passedCredits' | 'inProgressCredits' | 'unresolvedFailures' | 'standing';
export type RegisterStanding = StandingLevel | 'UNDETERMINED';

export interface RegisterQuery {
  programme?: string;
  yearGroup?: number;
  flag?: RegisterFlag;
  standing?: RegisterStanding;
  sort: RegisterSort;
  order: 'asc' | 'desc';
  page: number;
  pageSize?: number;
}

export interface RegisterRow extends StudentSummary {
  coursesOnRecord: number;
  passedCredits: number;
  inProgressCredits: number;
  unresolvedFailures: number;
  incompletes: number;
  flags: RegisterFlag[];
  standing: RegisterStanding;
}

export interface RegisterPage {
  rows: RegisterRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  counts: { students: number } & Record<RegisterFlag, number> & Record<RegisterStanding, number>;
}

function queryString(query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== '') params.set(key, String(value));
  return params.toString();
}
const registerParams = (query: RegisterQuery) => queryString(query);

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message?: string) {
    super(message ?? code);
  }
}

interface TokenResponse extends Session {
  accessToken: string;
}

type Fetch = typeof fetch;

/**
 * Keeps the access token in memory only. The refresh token lives in an httpOnly
 * cookie the page cannot read; an expired access token is renewed once, and
 * concurrent renewals share one request because each refresh token is single-use.
 */
export function createApiClient(baseUrl: string, fetchImpl: Fetch = (input, init) => fetch(input, init)) {
  let accessToken: string | undefined;
  let refreshing: Promise<Session> | undefined;

  async function send(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('x-requested-with', 'fetch');
    if (init.body) headers.set('content-type', 'application/json');
    if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
    return fetchImpl(`${baseUrl}${path}`, { ...init, headers, credentials: 'include' });
  }

  async function parse<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(response.status, body.error ?? 'REQUEST_FAILED', body.message);
    return body as T;
  }

  async function acceptTokens(response: Response): Promise<Session> {
    const { accessToken: token, role, passwordChangeRequired } = await parse<TokenResponse>(response);
    accessToken = token;
    return { role, passwordChangeRequired };
  }

  function refresh(): Promise<Session> {
    refreshing ??= send('/api/v1/auth/refresh', { method: 'POST' })
      .then(acceptTokens)
      .catch(error => {
        accessToken = undefined;
        throw error;
      })
      .finally(() => { refreshing = undefined; });
    return refreshing;
  }

  async function sendAuthorised(path: string, init?: RequestInit): Promise<Response> {
    const response = await send(path, init);
    if (response.status !== 401 || !accessToken) return response;
    await refresh();
    return send(path, init);
  }

  async function authorised<T>(path: string, init?: RequestInit): Promise<T> {
    return parse<T>(await sendAuthorised(path, init));
  }

  return {
    async login(identifier: string, password: string): Promise<Session> {
      return acceptTokens(await send('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) }));
    },
    restore: refresh,
    async logout(): Promise<void> {
      try {
        await send('/api/v1/auth/logout', { method: 'POST' });
      } finally {
        accessToken = undefined;
      }
    },
    async changePassword(currentPassword: string, newPassword: string): Promise<Session> {
      const response = await send('/api/v1/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
      return acceptTokens(response);
    },
    myRecord: () => authorised<StudentRecord>('/api/v1/students/me'),
    myEligibility: () => authorised<Eligibility>('/api/v1/students/me/eligibility'),
    studentEligibility: (studentId: string) => authorised<Eligibility>(`/api/v1/admin/students/${encodeURIComponent(studentId)}/eligibility`),
    curricula: () => authorised<{ curricula: CurriculumSummary[] }>('/api/v1/admin/curricula'),
    register: (query: RegisterQuery) => authorised<RegisterPage>(`/api/v1/admin/register?${registerParams(query)}`),
    inbox: () => authorised<{ messages: InboxItem[]; unread: number }>('/api/v1/students/me/messages'),
    unreadCount: () => authorised<{ unread: number }>('/api/v1/students/me/messages/unread-count'),
    markRead: (messageId: string) => authorised<{ marked: number }>(`/api/v1/students/me/messages/${encodeURIComponent(messageId)}/read`, { method: 'POST' }),
    markAllRead: () => authorised<{ marked: number }>('/api/v1/students/me/messages/read-all', { method: 'POST' }),
    messageTemplates: () => authorised<{ templates: MessageTemplate[] }>('/api/v1/admin/messages/templates'),
    previewAudience: (audience: MessageAudience) => authorised<{ recipientCount: number; unknownIds: string[] }>('/api/v1/admin/messages/preview', { method: 'POST', body: JSON.stringify({ audience }) }),
    sendMessage: (message: NewMessage) => authorised<{ message: SentMessage; unknownIds: string[] }>('/api/v1/admin/messages', { method: 'POST', body: JSON.stringify(message) }),
    sentMessages: () => authorised<{ messages: SentMessage[] }>('/api/v1/admin/messages'),
    importHistory: () => authorised<{ batches: ImportBatch[] }>('/api/v1/admin/imports'),
    previewImport: (upload: ImportUpload) => authorised<ImportPreview>('/api/v1/admin/imports/preview', { method: 'POST', body: JSON.stringify(upload) }),
    applyImport: (upload: ImportUpload) => authorised<{ batch: ImportBatch }>('/api/v1/admin/imports', { method: 'POST', body: JSON.stringify(upload) }),
    undoImport: (batchId: string) => authorised<{ status: string }>(`/api/v1/admin/imports/${encodeURIComponent(batchId)}/rollback`, { method: 'POST' }),
    issueTemporaryPassword: (identifier: string) => authorised<{ temporaryPassword: string }>('/api/v1/admin/users/reset-password', { method: 'POST', body: JSON.stringify({ identifier }) }),
    reports: (filters: ReportFilters) => authorised<Reports>(`/api/v1/admin/reports?${queryString(filters)}`),
    async reportCsv(section: 'cohorts' | 'programmes' | 'courses', filters: ReportFilters): Promise<Blob> {
      const response = await sendAuthorised(`/api/v1/admin/reports/${section}.csv?${queryString(filters)}`);
      if (!response.ok) await parse(response);
      return response.blob();
    },
    async registerCsv(query: RegisterQuery): Promise<Blob> {
      const response = await sendAuthorised(`/api/v1/admin/register.csv?${registerParams(query)}`);
      if (!response.ok) await parse(response);
      return response.blob();
    },
    searchStudents: (query: string) => authorised<{ students: StudentSummary[] }>(`/api/v1/admin/students?q=${encodeURIComponent(query)}`),
    studentRecord: (studentId: string) => authorised<StudentRecord>(`/api/v1/admin/students/${encodeURIComponent(studentId)}`)
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
