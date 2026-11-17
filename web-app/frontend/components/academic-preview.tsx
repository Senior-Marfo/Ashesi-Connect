import type { AcademicPreview } from '../lib/api';
import { describeIssue, reasonLabels } from '../lib/labels';

export type PreviewLoad = { status: 'loading' } | { status: 'unavailable' } | { status: 'ready'; preview: AcademicPreview };

const statusText: Record<AcademicPreview['status'], string> = {
  INSUFFICIENT_DATA: 'Not enough verified information yet',
  REQUIREMENTS_OUTSTANDING: 'Requirements remaining',
  ACADEMIC_REQUIREMENTS_MET: 'All listed requirements met'
};

export function AcademicPreviewPanel({ load }: { load: PreviewLoad }) {
  return (
    <section className="panel" aria-labelledby="preview-heading" aria-busy={load.status === 'loading'}>
      <div className="panel-head">
        <h2 id="preview-heading" className="section-title">Graduation progress</h2>
        <span className="chip">Provisional</span>
      </div>
      <p className="caption">An advisory preview, not an official degree audit, graduation approval or Registry certification.</p>
      {load.status === 'loading' && <div className="skeleton" />}
      {load.status === 'unavailable' && <p className="empty">The progress preview is unavailable right now. Your course record below is unaffected.</p>}
      {load.status === 'ready' && <PreviewBody preview={load.preview} />}
    </section>
  );
}

function PreviewBody({ preview }: { preview: AcademicPreview }) {
  const { audit } = preview;
  const issues = [...new Set(preview.issues.map(describeIssue))];
  return (
    <>
      <p className="preview-status">
        <strong>{statusText[preview.status]}</strong>
        {preview.curriculumVersion && <span className="muted"> · curriculum {preview.curriculumVersion}</span>}
      </p>
      {audit && (
        <>
          <div className="meter" role="meter" aria-label="Credits counted towards graduation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={audit.percentComplete}>
            <span style={{ width: `${audit.percentComplete}%` }} />
          </div>
          <p className="caption">{audit.creditsEarned} of {audit.creditsRequired} credits counted ({audit.percentComplete}%){audit.creditsInProgress > 0 ? `, ${audit.creditsInProgress} in progress` : ''}.</p>
          {audit.remainingRequirements.length > 0 && (
            <ul className="remaining">
              {audit.remainingRequirements.map((item, index) => (
                <li key={`${item.code}-${index}`}>
                  <span className="mono">{item.code}</span>
                  <span>{reasonLabels[item.reason]}</span>
                  <span className="num">{item.credits > 0 ? `${item.credits} cr` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {issues.length > 0 && (
        <ul className="issues">
          {issues.map(issue => <li key={issue}>{issue}</li>)}
        </ul>
      )}
      {preview.exploratoryGpa && (
        <p className="caption">
          Exploratory GPA: <strong>{preview.exploratoryGpa.gpa ?? 'not available'}</strong>. Not an official institutional GPA.
        </p>
      )}
    </>
  );
}
