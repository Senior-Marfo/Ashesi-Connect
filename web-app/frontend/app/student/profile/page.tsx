'use client';
import Link from 'next/link';
import { TRACKS } from '../../../lib/academic';
import { StudentEligibilityPage } from '../../../lib/eligibility-pages';

const trackLabel = (track: string) => TRACKS.find(option => option.value === track)?.label ?? track;

export default function ProfilePage() {
  return (
    <StudentEligibilityPage eyebrow="My account" title="Profile and security">
      {({ student, expectedGraduation, curriculum }) => (
        <>
          <section aria-labelledby="details-heading">
            <h2 id="details-heading" className="section-title">My details</h2>
            <dl className="facts">
              <div><dt>Name</dt><dd>{student.fullName}</dd></div>
              <div><dt>Student ID</dt><dd className="mono">{student.studentId}</dd></div>
              <div><dt>Programme</dt><dd>{student.programme}</dd></div>
              <div><dt>Year group</dt><dd>{student.yearGroup}</dd></div>
              <div><dt>Maths track</dt><dd>{trackLabel(student.track)}</dd></div>
              <div><dt>Expected graduation</dt><dd>{expectedGraduation}</dd></div>
            </dl>
            <p className="caption">
              {curriculum ? `Assessed against curriculum ${curriculum.version}. ` : ''}
              If any of these details are wrong, contact the Registry. Only the Registry can change them.
            </p>
          </section>
          <section aria-labelledby="security-heading" className="report-section">
            <h2 id="security-heading" className="section-title">Security</h2>
            <p>Changing your password signs you out on every other device.</p>
            <Link className="button" href="/change-password/">Change password</Link>
          </section>
        </>
      )}
    </StudentEligibilityPage>
  );
}
