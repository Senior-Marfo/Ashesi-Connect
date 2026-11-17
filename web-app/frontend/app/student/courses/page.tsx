'use client';
import { Notice, SkeletonRows } from '../../../components/app-shell';
import { StudentProfile } from '../../../components/student-record';
import { StudentEligibilityPage, passMarksOf } from '../../../lib/eligibility-pages';
import { useSession } from '../../../lib/session';
import { useLoad } from '../../../lib/use-load';

function Courses({ passMarks }: { passMarks: Record<string, string> }) {
  const { api } = useSession();
  const load = useLoad(() => api.myRecord(), true, 'record');
  if (load.status === 'loading') return <SkeletonRows rows={8} />;
  if (load.status === 'error') return <Notice tone="error">Your courses could not be loaded. Refresh the page to try again.</Notice>;
  return <StudentProfile record={load.data} passMarks={passMarks} />;
}

export default function CoursesPage() {
  return (
    <StudentEligibilityPage eyebrow="My academic record" title="My courses">
      {eligibility => <Courses passMarks={passMarksOf(eligibility)} />}
    </StudentEligibilityPage>
  );
}
