'use client';
import { RequirementTree } from '../../../components/requirements';
import { CurriculumNote, StatusCard } from '../../../components/standing';
import { StudentEligibilityPage } from '../../../lib/eligibility-pages';

export default function RequirementsPage() {
  return (
    <StudentEligibilityPage eyebrow="My programme" title="My requirements">
      {eligibility => eligibility.requirements.length === 0
        ? <StatusCard eligibility={eligibility} />
        : <><CurriculumNote eligibility={eligibility} /><RequirementTree groups={eligibility.requirements} /></>}
    </StudentEligibilityPage>
  );
}
