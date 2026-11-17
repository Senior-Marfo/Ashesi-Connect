'use client';
import Link from 'next/link';
import { Notice } from '../../components/app-shell';
import { StatusCard } from '../../components/standing';
import { StudentEligibilityPage } from '../../lib/eligibility-pages';

export default function StudentHomePage() {
  return (
    <StudentEligibilityPage eyebrow="My graduation status" title="Where you stand">
      {eligibility => (
        <>
          {eligibility.student.synthetic && <div className="synthetic-notice"><Notice>Synthetic record: a fictional student with illustrative courses, loaded for demonstration. Not real academic data.</Notice></div>}
          <p className="lede">Hello, {eligibility.student.fullName.split(' ')[0]}. {eligibility.student.programme} · year group {eligibility.student.yearGroup} · {eligibility.student.track} track</p>
          <StatusCard eligibility={eligibility} />
          {eligibility.requirements.length > 0 && (
            <section aria-labelledby="areas-heading" className="areas">
              <h2 id="areas-heading" className="section-title">By requirement area</h2>
              <ul>
                {eligibility.requirements.map(group => (
                  <li key={group.category}>
                    <span>{group.category}</span>
                    <span className="meter"><span style={{ width: `${Math.min(100, (group.creditsCompleted / Math.max(group.creditsRequired, 0.01)) * 100)}%` }} /></span>
                    <span className="num">{group.creditsCompleted}/{group.creditsRequired}</span>
                  </li>
                ))}
              </ul>
              <p><Link href="/student/requirements/">See every requirement</Link> · <Link href="/student/remaining/">See what remains</Link></p>
            </section>
          )}
        </>
      )}
    </StudentEligibilityPage>
  );
}
