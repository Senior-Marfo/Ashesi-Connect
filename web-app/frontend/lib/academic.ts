/** Mirrors web-app/backend/src/domain/programmes.ts. */
export const PROGRAMMES = ['BA', 'ECON', 'LLB', 'MIS', 'CS', 'CE', 'EE', 'ME', 'MT', 'BE'] as const;
export const TRACKS = [
  { value: 'standard', label: 'Standard' },
  { value: 'pre-calculus', label: 'Pre-calculus' },
  { value: 'calculus-1-2', label: 'Calculus 1 and 2' }
] as const;
export const GRADE_SCALE = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E'] as const;
