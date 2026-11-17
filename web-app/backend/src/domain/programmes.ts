/** Undergraduate programmes and their maths tracks. */
export const PROGRAMMES = ['BA', 'ECON', 'LLB', 'MIS', 'CS', 'CE', 'EE', 'ME', 'MT', 'BE'] as const;
export type Programme = (typeof PROGRAMMES)[number];
export const TRACKS = ['standard', 'pre-calculus', 'calculus-1-2'] as const;
export const GRADE_SCALE = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E'] as const;
