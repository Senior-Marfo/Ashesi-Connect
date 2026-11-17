import type { Eligibility, StandingLevel } from '../lib/api';
import { actionLabels, describeIssue, describeStandingReason, standingLabels } from '../lib/labels';

/** Colour is never the only signal: each level has its own icon and text. */
export function StandingBadge({ level, met = false }: { level: StandingLevel; met?: boolean }) {
  return (
    <span className={`standing ${level.toLowerCase()}`}>
      <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
        {level === 'GREEN' && <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
        {level === 'YELLOW' && <><path d="M8 2l6.5 12h-13z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M8 6.5v3.5M8 12v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>}
        {level === 'RED' && <><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>}
      </svg>
      {met ? 'Requirements met' : standingLabels[level]}
    </span>
  );
}

export function ProgressRing({ percent, inProgressPercent, label }: { percent: number; inProgressPercent: number; label: string }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const done = Math.min(100, Math.max(0, percent));
  const pending = Math.min(100 - done, Math.max(0, inProgressPercent));
  return (
    <div className="ring" role="img" aria-label={label}>
      <svg viewBox="0 0 120 120" width="148" height="148" aria-hidden="true">
        <circle className="ring-track" cx="60" cy="60" r={radius} />
        <circle className="ring-pending" cx="60" cy="60" r={radius} strokeDasharray={`${(pending / 100) * circumference} ${circumference}`} strokeDashoffset={-((done / 100) * circumference)} />
        <circle className="ring-done" cx="60" cy="60" r={radius} strokeDasharray={`${(done / 100) * circumference} ${circumference}`} />
      </svg>
      <span className="ring-value"><strong>{Math.round(done)}%</strong><small>complete</small></span>
    </div>
  );
}

export function CurriculumNote({ eligibility }: { eligibility: Eligibility }) {
  if (eligibility.curriculum?.basis === 'SYNTHETIC') {
    return <p className="caption">Assessed against <strong>illustrative synthetic programme rules</strong> for demonstration and testing, not the official curriculum. Advisory only, never a Registry certification.</p>;
  }
  return <p className="caption">Assessed against the Registry-reviewed curriculum {eligibility.curriculum?.version}. Advisory only, never an official graduation decision.</p>;
}

/** The home-screen summary: status, standing, progress and the top next actions. */
export function StatusCard({ eligibility }: { eligibility: Eligibility }) {
  const { audit, standing } = eligibility;
  if (eligibility.status === 'NO_CURRICULUM' || eligibility.status === 'DATA_ISSUES' || !audit || !standing) {
    return (
      <section className="status-card" aria-labelledby="status-heading">
        <h2 id="status-heading" className="section-title">Graduation status</h2>
        <p className="status-headline">Not available yet</p>
        <ul className="issues">{eligibility.issues.map(issue => <li key={issue}>{describeIssue(issue)}</li>)}</ul>
        <p className="caption">Your courses and grades below are unaffected. Expected graduation: {eligibility.expectedGraduation}.</p>
      </section>
    );
  }
  const met = eligibility.status === 'REQUIREMENTS_MET';
  const inProgressPercent = (audit.creditsInProgress / audit.creditsRequired) * 100;
  return (
    <section className={`status-card level-${standing.level.toLowerCase()}`} aria-labelledby="status-heading">
      <div className="status-main">
        <ProgressRing percent={audit.percentComplete} inProgressPercent={inProgressPercent} label={`${audit.creditsEarned} of ${audit.creditsRequired} credits completed, ${audit.creditsInProgress} in progress`} />
        <div>
          <h2 id="status-heading" className="section-title">Graduation status</h2>
          <p className="status-headline">{met ? 'All requirements met' : 'Not yet eligible'}</p>
          <StandingBadge level={standing.level} met={met} />
          <ul className="reasons">
            {standing.reasons.map(reason => <li key={reason}>{describeStandingReason(reason, standing.creditsPerTermNeeded)}</li>)}
          </ul>
        </div>
      </div>
      <dl className="figures">
        <div><dt>Credits completed</dt><dd>{audit.creditsEarned}<small> / {audit.creditsRequired}</small></dd></div>
        <div><dt>In progress</dt><dd>{audit.creditsInProgress}</dd></div>
        <div><dt>Expected graduation</dt><dd className="term">{eligibility.expectedGraduation}</dd></div>
      </dl>
      {eligibility.nextActions.length > 0 && (
        <div className="next-actions">
          <h3>Next steps</h3>
          <ol>
            {eligibility.nextActions.map(action => (
              <li key={`${action.kind}-${action.code}`}>
                <span className="action-kind">{actionLabels[action.kind]}</span>
                <span className="mono">{action.kind === 'CHOOSE_ELECTIVE' ? action.category : action.code}</span>
                <span className="muted">{action.kind === 'CHOOSE_ELECTIVE' ? `${action.credits} credit${action.credits === 1 ? '' : 's'} left` : action.category}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <CurriculumNote eligibility={eligibility} />
    </section>
  );
}
