import type { DetailedAudit, ProgrammeRules } from '../domain/eligibility/programme-audit.js';
import { evaluateProgramme } from '../domain/eligibility/programme-audit.js';
import { requirementBreakdown, type RequirementGroup } from '../domain/eligibility/requirement-breakdown.js';
import { assessStanding, type Standing, type StandingConfig } from '../domain/eligibility/standing.js';
import { graduationTerm, termName, termsRemaining } from '../domain/eligibility/terms.js';
import { mapEnrollmentTranscript } from '../domain/eligibility/transcript-mapping.js';
import type { CourseRecord, StudentSummary } from '../repositories/types.js';

export type CurriculumBasis = 'REVIEWED' | 'SYNTHETIC';
export interface AppliedCurriculum { basis: CurriculumBasis; version: string; rules: ProgrammeRules }

export interface NextAction {
  kind: 'RETAKE' | 'RESOLVE_INCOMPLETE' | 'TAKE_COURSE' | 'CHOOSE_ELECTIVE';
  code: string;
  category: string;
  credits: number;
}

export interface EligibilityView {
  student: StudentSummary;
  /** Never an official audit, graduation approval or Registry certification. */
  officialCertification: false;
  status: 'NO_CURRICULUM' | 'DATA_ISSUES' | 'REQUIREMENTS_MET' | 'REQUIREMENTS_REMAINING';
  curriculum: { basis: CurriculumBasis; version: string } | null;
  expectedGraduation: string;
  audit: (Omit<DetailedAudit, 'eligible' | 'eligibilityDetermined' | 'severity'>) | null;
  standing: Standing | null;
  requirements: RequirementGroup[];
  nextActions: NextAction[];
  issues: string[];
}

const ACTION_ORDER: NextAction['kind'][] = ['RETAKE', 'RESOLVE_INCOMPLETE', 'TAKE_COURSE', 'CHOOSE_ELECTIVE'];

export function assessEligibility(
  student: StudentSummary,
  courses: CourseRecord[],
  curriculum: AppliedCurriculum | undefined,
  today: Date,
  config?: StandingConfig
): EligibilityView {
  const base = {
    student,
    officialCertification: false as const,
    expectedGraduation: termName(graduationTerm(student.yearGroup)),
    curriculum: curriculum ? { basis: curriculum.basis, version: curriculum.version } : null,
    audit: null, standing: null, requirements: [], nextActions: []
  };
  if (!curriculum) return { ...base, status: 'NO_CURRICULUM', issues: ['CURRICULUM_UNAVAILABLE'] };

  const transcript = mapEnrollmentTranscript(courses);
  if (transcript.issues.length > 0) return { ...base, status: 'DATA_ISSUES', issues: transcript.issues };

  const { eligible: _eligible, eligibilityDetermined: _determined, severity: _severity, ...audit } = evaluateProgramme(transcript.entries, curriculum.rules);
  const latest = new Map(transcript.entries.map(entry => [entry.courseCode, entry]));
  for (const entry of transcript.entries) if (entry.attempt > (latest.get(entry.courseCode)?.attempt ?? 0)) latest.set(entry.courseCode, entry);
  const creditsInProgress = Math.round([...latest.values()].filter(entry => entry.status === 'IN_PROGRESS').reduce((sum, entry) => sum + entry.credits, 0) * 100) / 100;
  const standing = assessStanding({ ...audit, eligible: false, eligibilityDetermined: false, severity: 'UNDETERMINED' }, { creditsInProgress, termsRemaining: termsRemaining(student.yearGroup, today) }, config);

  const actions: NextAction[] = [];
  for (const item of audit.remainingRequirements) {
    if (item.reason === 'FAILED') actions.push({ kind: 'RETAKE', code: item.code, category: item.category, credits: item.credits });
    else if (item.reason === 'INCOMPLETE') actions.push({ kind: 'RESOLVE_INCOMPLETE', code: item.code, category: item.category, credits: item.credits });
    else if (item.reason === 'NOT_TAKEN') actions.push({ kind: 'TAKE_COURSE', code: item.code, category: item.category, credits: item.credits });
    else if (item.reason === 'ELECTIVE_SLOT_OPEN') actions.push({ kind: 'CHOOSE_ELECTIVE', code: item.code, category: item.category, credits: item.credits });
  }
  actions.sort((a, b) => ACTION_ORDER.indexOf(a.kind) - ACTION_ORDER.indexOf(b.kind));

  return {
    ...base,
    status: audit.remainingRequirements.length === 0 ? 'REQUIREMENTS_MET' : 'REQUIREMENTS_REMAINING',
    audit: { ...audit, creditsInProgress },
    standing,
    requirements: requirementBreakdown(transcript.entries, curriculum.rules),
    nextActions: actions.slice(0, 3),
    issues: []
  };
}
