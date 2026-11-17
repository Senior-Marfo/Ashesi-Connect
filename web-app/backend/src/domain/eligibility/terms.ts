/**
 * Academic terms as ordinals: Spring of year Y is 2Y, Fall of year Y is 2Y + 1.
 * Fall runs August–December and Spring January–May; June–July is between terms.
 */
export function currentTerm(today: Date): { ordinal: number; inProgress: boolean } {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;
  if (month >= 8) return { ordinal: year * 2 + 1, inProgress: true };
  if (month <= 5) return { ordinal: year * 2, inProgress: true };
  return { ordinal: year * 2, inProgress: false };
}

/** A year group graduates at the end of Spring of that year. */
export const graduationTerm = (yearGroup: number) => yearGroup * 2;

/** Whole terms still to come before graduation, not counting a term already under way. */
export function termsRemaining(yearGroup: number, today: Date): number {
  return Math.max(0, graduationTerm(yearGroup) - currentTerm(today).ordinal);
}

export function termName(ordinal: number): string {
  return ordinal % 2 === 1 ? `${(ordinal - 1) / 2} Fall` : `${ordinal / 2} Spring`;
}
