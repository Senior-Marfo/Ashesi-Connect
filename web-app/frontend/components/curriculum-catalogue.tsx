import type { CurriculumSummary } from '../lib/api';
import { sentenceCase } from '../lib/labels';
import { Notice, SkeletonRows } from './app-shell';

export type CatalogueLoad = { status: 'loading' | 'error' } | { status: 'ready'; curricula: CurriculumSummary[] };

const statusClass: Record<CurriculumSummary['status'], string> = { REVIEWED: 'completed', DRAFT: 'enrolled', SUPERSEDED: '' };

export function CurriculumCatalogue({ load }: { load: CatalogueLoad }) {
  return (
    <section aria-labelledby="catalogue-heading" className="catalogue">
      <h2 id="catalogue-heading" className="section-title">Curriculum catalogue</h2>
      <p className="caption">
        Read-only. A curriculum is used for student previews only once it is reviewed with no validation issues. Registry approval evidence must be verified independently; nothing here is a graduation decision.
      </p>
      {load.status === 'loading' && <SkeletonRows rows={3} />}
      {load.status === 'error' && <Notice tone="error">The curriculum catalogue could not be loaded.</Notice>}
      {load.status === 'ready' && load.curricula.length === 0 && <p className="empty">No curricula have been imported yet.</p>}
      {load.status === 'ready' && load.curricula.length > 0 && (
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Curriculum catalogue">
          <table className="courses">
            <thead>
              <tr><th scope="col">Programme</th><th scope="col">Track</th><th scope="col">Version</th><th scope="col">Status</th><th scope="col">Validation</th></tr>
            </thead>
            <tbody>
              {load.curricula.map(item => (
                <tr key={`${item.programme}-${item.track}-${item.version}`}>
                  <th scope="row">{item.programme}</th>
                  <td>{item.track}</td>
                  <td className="mono">{item.version}</td>
                  <td><span className={`chip ${statusClass[item.status]}`}>{sentenceCase(item.status)}</span></td>
                  <td>{item.validationIssues.length ? item.validationIssues.map(sentenceCase).join(', ') : 'No issues'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
