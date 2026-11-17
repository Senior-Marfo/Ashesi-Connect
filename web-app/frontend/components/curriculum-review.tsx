'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, type ApiClient, type CurriculumKey, type StoredCurriculum } from '../lib/api';
import { sentenceCase } from '../lib/labels';
import { Notice, SkeletonRows } from './app-shell';

type Api = Pick<ApiClient, 'curriculumDetail' | 'reviewCurriculum'>;
type Load = { status: 'loading' | 'error' } | { status: 'ready'; curriculum: StoredCurriculum };

const REVIEW_ERRORS: Record<string, string> = {
  CURRICULUM_REVIEW_DISABLED: 'Review is switched off on this deployment.',
  REVIEWER_NOT_AUTHORIZED: 'Your account is not on the reviewer list.',
  CURRICULUM_REVIEW_BLOCKED: 'This version cannot be reviewed: it is not a draft, or it has validation issues.',
  CURRICULUM_REVIEW_CONFLICT: 'Someone else reviewed this version first. The page has been refreshed.',
  CURRICULUM_NOT_FOUND: 'This version no longer exists.'
};
const credits = (value: number) => `${value} credit${value === 1 ? '' : 's'}`;
const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });

/** A curriculum version's full requirements, and the Registry review of a draft. */
export function CurriculumReview({ api, curriculumKey, access, onReviewed }: {
  api: Api;
  curriculumKey: CurriculumKey;
  access: { enabled: boolean; allowed: boolean } | null;
  onReviewed: () => void;
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [evidence, setEvidence] = useState('');
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const { programme, track, version } = curriculumKey;

  async function refresh() {
    try {
      setLoad({ status: 'ready', curriculum: (await api.curriculumDetail({ programme, track, version })).curriculum });
    } catch {
      setLoad({ status: 'error' });
    }
  }
  useEffect(() => {
    setLoad({ status: 'loading' });
    setNotice(null);
    setEvidence('');
    setChecked(false);
    void refresh();
  }, [programme, track, version]); // eslint-disable-line react-hooks/exhaustive-deps

  async function review(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm(`Mark ${programme} ${track} ${version} as reviewed? Real students on this programme and track will then be assessed against it.`)) return;
    setBusy(true);
    try {
      await api.reviewCurriculum({ programme, track, version }, evidence.trim());
      setNotice({ tone: 'info', text: `${programme} ${track} ${version} is now reviewed.` });
      onReviewed();
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof ApiError ? REVIEW_ERRORS[cause.code] ?? 'The review could not be saved.' : 'The review could not be saved.' });
    } finally {
      setBusy(false);
      await refresh();
    }
  }

  if (load.status !== 'ready') {
    return load.status === 'loading' ? <SkeletonRows rows={5} /> : <Notice tone="error">This curriculum could not be loaded.</Notice>;
  }
  const { curriculum } = load;
  const byCategory = new Map<string, StoredCurriculum['rules']['requiredCourses']>();
  for (const course of curriculum.rules.requiredCourses) byCategory.set(course.category, [...(byCategory.get(course.category) ?? []), course]);
  const requiredCredits = curriculum.rules.requiredCourses.reduce((sum, course) => sum + course.credits, 0);
  const blocker = curriculum.status !== 'DRAFT' ? null
    : !access?.enabled ? 'Review is switched off on this deployment (ENABLE_CURRICULUM_REVIEW).'
    : !access.allowed ? 'Your account is not on the reviewer list (CURRICULUM_REVIEWER_IDS).'
    : curriculum.validationIssues.length ? 'Fix the validation issues before review: import a corrected draft.'
    : null;

  return (
    <section className="curriculum-review" aria-labelledby="review-heading">
      <div className="report-head">
        <h3 id="review-heading" className="subhead">{programme} · {track} · <span className="mono">{version}</span></h3>
        <span className={`chip ${curriculum.status === 'REVIEWED' ? 'completed' : curriculum.status === 'DRAFT' ? 'enrolled' : ''}`}>{sentenceCase(curriculum.status)}</span>
      </div>
      <dl className="facts">
        <div><dt>Total credits</dt><dd>{curriculum.rules.totalCredits}</dd></div>
        <div><dt>Required courses</dt><dd>{curriculum.rules.requiredCourses.length} ({credits(requiredCredits)})</dd></div>
        <div><dt>Elective credits</dt><dd>{curriculum.rules.electivePools.reduce((sum, pool) => sum + pool.creditsRequired, 0)}</dd></div>
        <div><dt>Source workbook</dt><dd className="mono">{curriculum.sourceWorkbookHash ? `${curriculum.sourceWorkbookHash.slice(0, 12)}…` : '—'}</dd></div>
      </dl>
      {curriculum.validationIssues.length > 0 && (
        <Notice tone="error">Validation issues: {curriculum.validationIssues.map(sentenceCase).join(', ')}.</Notice>
      )}

      <h4 className="review-subhead">Required courses</h4>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Required courses">
        <table className="courses">
          <thead><tr><th scope="col">Category</th><th scope="col">Course</th><th scope="col" className="num">Credits</th><th scope="col">Pass mark</th></tr></thead>
          <tbody>
            {[...byCategory].flatMap(([category, courses]) => courses.map((course, index) => (
              <tr key={course.courseCode}>
                <td>{index === 0 ? category : ''}</td>
                <td className="mono">{course.courseCode}</td>
                <td className="num">{course.credits}</td>
                <td>{course.minimumGrade === 'C' ? <strong>C</strong> : course.minimumGrade}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>

      {curriculum.rules.electivePools.length > 0 && (
        <>
          <h4 className="review-subhead">Elective slots</h4>
          <ul className="pool-list">
            {curriculum.rules.electivePools.map(pool => (
              <li key={pool.category}>
                <strong>{pool.category}</strong>: {credits(pool.creditsRequired)} from {pool.courseCodes.length} option{pool.courseCodes.length === 1 ? '' : 's'}
                {pool.africanStudiesMinimum ? `, at least ${pool.africanStudiesMinimum} African Studies` : ''}
                {pool.minimumGrade ? `, pass mark ${pool.minimumGrade}` : ''}
                <div className="muted mono pool-options">
                  {pool.courseCodes.map(code => (pool.africanStudiesCodes?.includes(code) ? `${code} (African Studies)` : code)).join(' · ')}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="caption">
        Source: {curriculum.sources.map(source => `${source.sourceKind === 'REGISTRY_PROVIDED_WORKBOOK' ? 'Registry workbook' : 'Official website'} (${source.effectiveYear}), retrieved ${formatDate(source.retrievedAt)}`).join('; ')}.
      </p>

      {curriculum.review && (
        <Notice>
          Reviewed by <span className="mono">{curriculum.review.reviewerIdentifier ?? 'a removed account'}</span> on {formatDate(curriculum.review.reviewedAt)}. Evidence: {curriculum.review.evidenceReference}
        </Notice>
      )}
      {curriculum.status === 'DRAFT' && blocker && <Notice>{blocker}</Notice>}
      {curriculum.status === 'DRAFT' && !blocker && (
        <form className="form review-form" onSubmit={event => void review(event)}>
          <div className="field">
            <label htmlFor="review-evidence">Evidence of Registry approval</label>
            <input id="review-evidence" className="input" required maxLength={500} value={evidence} onChange={event => setEvidence(event.target.value)} placeholder="e.g. Registry memo REG/2028/14 of 3 December 2026" />
          </div>
          <label className="check">
            <input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />
            I have checked these requirements against the curriculum the Registry approved.
          </label>
          <button className="button" type="submit" disabled={busy || !checked || !evidence.trim()}>{busy ? 'Saving…' : 'Mark as reviewed'}</button>
        </form>
      )}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
    </section>
  );
}
