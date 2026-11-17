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

/** Advisory only: never an official audit, graduation approval or Registry certification. */
export interface AcademicPreview {
  status: 'INSUFFICIENT_DATA' | 'REQUIREMENTS_OUTSTANDING' | 'ACADEMIC_REQUIREMENTS_MET';
  officialCertification: false;
  programme: string;
  track: string;
  yearGroup: number;
  curriculumVersion: string | null;
  issues: string[];
  exploratoryGpa?: { gpa: number | null; issues: string[] };
  audit: null | {
    creditsEarned: number;
    creditsRequired: number;
    creditsInProgress: number;
    percentComplete: number;
    remainingRequirements: Array<{ code: string; category: string; credits: number; reason: RemainingReason }>;
  };
}

export interface CurriculumSummary {
  programme: string;
  track: string;
  version: string;
  status: 'DRAFT' | 'REVIEWED' | 'SUPERSEDED';
  validationIssues: string[];
  updatedAt?: string;
}

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

  async function authorised<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await send(path, init);
    if (response.status !== 401 || !accessToken) return parse<T>(response);
    await refresh();
    return parse<T>(await send(path, init));
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
    academicPreview: () => authorised<AcademicPreview>('/api/v1/students/me/academic-preview'),
    curricula: () => authorised<{ curricula: CurriculumSummary[] }>('/api/v1/admin/curricula'),
    searchStudents: (query: string) => authorised<{ students: StudentSummary[] }>(`/api/v1/admin/students?q=${encodeURIComponent(query)}`),
    studentRecord: (studentId: string) => authorised<StudentRecord>(`/api/v1/admin/students/${encodeURIComponent(studentId)}`)
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
