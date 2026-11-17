import { describe, expect, it } from 'vitest';
import type { DetailedAudit, Remaining } from './programme-audit.js';
import { assessStanding } from './standing.js';
import { currentTerm, termName, termsRemaining } from './terms.js';

const audit = (remaining: Remaining['reason'][], creditsEarned: number, creditsRequired = 36): DetailedAudit => ({
  eligible: false, eligibilityDetermined: false, creditsEarned, creditsRequired, creditsInProgress: 0, percentComplete: 0, severity: 'UNDETERMINED',
  remainingRequirements: remaining.map((reason, index) => ({ code: `C${index}`, category: 'Major', credits: 1, reason }))
});

describe('terms', () => {
  it('maps dates to terms and counts terms left before graduation', () => {
    expect(currentTerm(new Date('2026-11-17T00:00:00Z'))).toEqual({ ordinal: 4053, inProgress: true });
    expect(currentTerm(new Date('2026-03-01T00:00:00Z'))).toEqual({ ordinal: 4052, inProgress: true });
    expect(currentTerm(new Date('2026-07-01T00:00:00Z'))).toEqual({ ordinal: 4052, inProgress: false });
    expect(termName(4053)).toBe('2026 Fall');
    const today = new Date('2026-11-17T00:00:00Z');
    expect([2026, 2027, 2028, 2030].map(year => termsRemaining(year, today))).toEqual([0, 1, 3, 7]);
  });
});

describe('standing', () => {
  it('is green when every requirement is met', () => {
    expect(assessStanding(audit([], 36), { creditsInProgress: 0, termsRemaining: 0 })).toMatchObject({ level: 'GREEN', reasons: ['REQUIREMENTS_MET'], creditsOutstanding: 0 });
  });

  it('is green when only courses in progress remain, or the rest fits a normal load', () => {
    expect(assessStanding(audit(['IN_PROGRESS', 'IN_PROGRESS'], 34), { creditsInProgress: 2, termsRemaining: 0 }).level).toBe('GREEN');
    expect(assessStanding(audit(['NOT_TAKEN'], 10), { creditsInProgress: 5, termsRemaining: 5 })).toMatchObject({ level: 'GREEN', reasons: ['ON_TRACK'], creditsOutstanding: 21, creditsPerTermNeeded: 4.2 });
  });

  it('is amber for a course to retake or resolve, or a heavier than normal load', () => {
    expect(assessStanding(audit(['FAILED'], 20), { creditsInProgress: 5, termsRemaining: 3 })).toMatchObject({ level: 'YELLOW', reasons: ['FAILED_COURSE_TO_RETAKE'] });
    expect(assessStanding(audit(['INCOMPLETE'], 20), { creditsInProgress: 5, termsRemaining: 3 }).reasons).toEqual(['INCOMPLETE_TO_RESOLVE']);
    expect(assessStanding(audit(['NOT_TAKEN'], 14), { creditsInProgress: 5, termsRemaining: 3 })).toMatchObject({ level: 'YELLOW', reasons: ['HEAVY_LOAD_NEEDED'], creditsPerTermNeeded: 5.67 });
  });

  it('is red when the rest cannot fit, graduation has passed, or many required courses failed', () => {
    expect(assessStanding(audit(['NOT_TAKEN'], 10), { creditsInProgress: 5, termsRemaining: 3 }).reasons).toEqual(['CANNOT_FINISH_IN_TIME']);
    expect(assessStanding(audit(['FAILED'], 35), { creditsInProgress: 0, termsRemaining: 0 })).toMatchObject({ level: 'RED', reasons: ['PAST_EXPECTED_GRADUATION', 'FAILED_COURSE_TO_RETAKE'] });
    expect(assessStanding(audit(['FAILED', 'FAILED', 'FAILED'], 20), { creditsInProgress: 5, termsRemaining: 3 })).toMatchObject({ level: 'RED', reasons: ['MULTIPLE_FAILED_COURSES', 'FAILED_COURSE_TO_RETAKE'] });
  });

  it('honours configured thresholds', () => {
    const tight = { normalLoad: 4, maxLoad: 5, criticalFailedCourses: 1 };
    expect(assessStanding(audit(['FAILED'], 20), { creditsInProgress: 5, termsRemaining: 3 }, tight).level).toBe('RED');
  });
});
