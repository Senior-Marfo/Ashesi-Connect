/** Mirrors the API: Spring of year Y is 2Y, Fall is 2Y + 1; June–July is between terms. */
export function currentTermOrdinal(today: Date): number {
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  return month >= 8 ? year * 2 + 1 : year * 2;
}

export function termName(ordinal: number): string {
  return ordinal % 2 === 1 ? `${(ordinal - 1) / 2} Fall` : `${ordinal / 2} Spring`;
}
