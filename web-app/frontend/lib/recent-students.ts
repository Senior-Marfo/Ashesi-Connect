/** The last few student records an admin opened, kept only in this browser. */
export interface RecentStudent {
  studentId: string;
  fullName: string;
}

const KEY = 'agt.recent-students';
const LIMIT = 6;

function isRecent(value: unknown): value is RecentStudent {
  return typeof value === 'object' && value !== null
    && typeof (value as RecentStudent).studentId === 'string' && typeof (value as RecentStudent).fullName === 'string';
}

export function loadRecentStudents(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): RecentStudent[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isRecent).slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}

/** Moves the student to the front of the list, keeping at most six; returns the new list. */
export function rememberStudent(student: RecentStudent, storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage): RecentStudent[] {
  const next = [{ studentId: student.studentId, fullName: student.fullName }, ...loadRecentStudents(storage).filter(entry => entry.studentId !== student.studentId)].slice(0, LIMIT);
  try {
    storage?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private windows and full storage still get the list for this visit.
  }
  return next;
}

export function forgetRecentStudents(storage: Pick<Storage, 'removeItem'> | undefined = globalThis.localStorage): void {
  try {
    storage?.removeItem(KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}
