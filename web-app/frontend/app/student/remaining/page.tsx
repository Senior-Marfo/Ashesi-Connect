'use client';
import { RemainingPlan } from '../../../components/requirements';
import { CurriculumNote, StatusCard } from '../../../components/standing';
import { StudentEligibilityPage } from '../../../lib/eligibility-pages';

export default function RemainingPage() {
  return (
    <StudentEligibilityPage eyebrow="My path to graduation" title="What’s remaining">
      {eligibility => eligibility.audit
        ? <><CurriculumNote eligibility={eligibility} /><RemainingPlan eligibility={eligibility} /></>
        : <StatusCard eligibility={eligibility} />}
    </StudentEligibilityPage>
  );
}
