import type { StudentSummary } from '../repositories/types.js';

export type MatchKind = 'ID' | 'NAME' | 'CLOSE_ID' | 'CLOSE_NAME';
export interface StudentMatch extends StudentSummary {
  match: MatchKind;
}

/** Shortest ID fragment that is checked for typos; shorter fragments match far too many IDs. */
const MIN_FUZZY_ID_LENGTH = 6;
const CLOSE_SCORE = 10;

export function normalise(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Optimal string alignment distance: insertions, deletions, substitutions and adjacent transpositions. */
export function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
}

/** Distance from a typed fragment to the closest start of the target, so a typo in a partial ID still matches. */
function prefixDistance(fragment: string, target: string): number {
  return Math.min(...[-1, 0, 1].map(delta => editDistance(fragment, target.slice(0, Math.max(0, fragment.length + delta)))));
}

function allowedTypos(token: string): number {
  if (token.length >= 7) return 2;
  return token.length >= 4 ? 1 : 0;
}

function scoreId(query: string, studentId: string): { match: MatchKind; score: number } | undefined {
  const id = studentId.toLowerCase();
  if (id === query) return { match: 'ID', score: 0 };
  if (id.startsWith(query)) return { match: 'ID', score: 1 };
  if (query.length < MIN_FUZZY_ID_LENGTH) return undefined;
  // A fragment as long as the ID is a whole ID with a typo, not the start of a longer one.
  const distance = query.length >= id.length ? editDistance(query, id) : prefixDistance(query, id);
  return distance <= 1 ? { match: 'CLOSE_ID', score: CLOSE_SCORE + distance } : undefined;
}

function scoreName(query: string, fullName: string): { match: MatchKind; score: number } | undefined {
  const tokens = normalise(fullName).split(/[\s'-]+/).filter(Boolean);
  const terms = query.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return undefined;
  let typos = 0;
  for (const term of terms) {
    if (tokens.some(token => token.startsWith(term))) continue;
    const best = Math.min(...tokens.map(token => prefixDistance(term, token)));
    if (best > allowedTypos(term)) return undefined;
    typos += best;
  }
  return typos === 0 ? { match: 'NAME', score: 2 } : { match: 'CLOSE_NAME', score: CLOSE_SCORE + typos };
}

/**
 * Ranks students for a search box: exact and prefix ID matches first, then name matches,
 * and only when nothing matches as typed, near misses (one typo in an ID of six or more characters,
 * or small typos in a name).
 */
export function searchStudents(students: StudentSummary[], rawQuery: string, limit: number): StudentMatch[] {
  const query = normalise(rawQuery);
  if (!query) return [];
  const idLike = /^[\w-]+$/.test(query) && /\d/.test(query);
  const scored = students.flatMap(student => {
    const best = [idLike ? scoreId(query, student.studentId) : undefined, scoreName(query, student.fullName)]
      .filter(candidate => candidate !== undefined)
      .sort((a, b) => a.score - b.score)[0];
    return best ? [{ student, ...best }] : [];
  });
  // Near misses only help when nothing matches as typed.
  const exact = scored.filter(candidate => candidate.score < CLOSE_SCORE);
  return (exact.length > 0 ? exact : scored)
    .sort((a, b) => a.score - b.score || a.student.studentId.localeCompare(b.student.studentId))
    .slice(0, limit)
    .map(({ student, match }) => ({ ...student, match }));
}
