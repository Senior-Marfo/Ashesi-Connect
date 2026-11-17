'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ADMIN_NAV, AppShell, FullPageLoading, Notice, SkeletonRows } from '../../../components/app-shell';
import { StandingBadge } from '../../../components/standing';
import type { RegisterFlag, RegisterPage, RegisterQuery, RegisterSort, RegisterStanding } from '../../../lib/api';
import { standingLabels } from '../../../lib/labels';
import { saveBlob } from '../../../lib/download';
import { useRequireRole, useSession } from '../../../lib/session';

/** The messaging API accepts at most this many named students. */
const MAX_RECIPIENTS = 500;
const PROGRAMMES = ['BA', 'ECON', 'LLB', 'MIS', 'CS', 'CE', 'EE', 'ME', 'MT', 'BE'];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_GROUPS = Array.from({ length: 7 }, (_, index) => CURRENT_YEAR - 2 + index);

const FLAG_LABELS: Record<RegisterFlag, string> = {
  UNRESOLVED_FAILURE: 'Failed course not yet retaken',
  INCOMPLETE: 'Incomplete course',
  NO_RECORDS: 'No courses on record'
};

const COLUMNS: Array<{ key: RegisterSort; label: string; numeric?: boolean }> = [
  { key: 'studentId', label: 'Student ID' },
  { key: 'fullName', label: 'Name' },
  { key: 'programme', label: 'Programme' },
  { key: 'yearGroup', label: 'Year group', numeric: true },
  { key: 'passedCredits', label: 'Passed credits', numeric: true },
  { key: 'inProgressCredits', label: 'In progress', numeric: true },
  { key: 'unresolvedFailures', label: 'Not retaken', numeric: true },
  { key: 'standing', label: 'Standing' }
];

const STANDING_OPTIONS: Array<[RegisterStanding, string]> = [
  ['RED', `${standingLabels.RED} (red)`], ['YELLOW', `${standingLabels.YELLOW} (amber)`], ['GREEN', `${standingLabels.GREEN} (green)`], ['UNDETERMINED', 'Not determined']
];

type Load = { status: 'loading' | 'error' } | { status: 'ready'; page: RegisterPage };

export default function RegisterPageView() {
  const session = useRequireRole('ADMIN');
  const { api } = useSession();
  const [query, setQuery] = useState<RegisterQuery>({ sort: 'studentId', order: 'asc', page: 1 });
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [exportError, setExportError] = useState(false);

  useEffect(() => {
    if (!session) return;
    let active = true;
    setLoad(current => (current.status === 'ready' ? current : { status: 'loading' }));
    api.register(query)
      .then(page => { if (active) setLoad({ status: 'ready', page }); })
      .catch(() => { if (active) setLoad({ status: 'error' }); });
    return () => { active = false; };
  }, [api, query, session]);

  if (!session) return <FullPageLoading />;

  const update = (changes: Partial<RegisterQuery>) => setQuery(current => ({ ...current, page: 1, ...changes }));
  const sortBy = (key: RegisterSort) =>
    update({ sort: key, order: query.sort === key && query.order === 'asc' ? 'desc' : ['studentId', 'fullName', 'programme', 'standing'].includes(key) ? 'asc' : 'desc' });

  async function exportCsv() {
    setExporting(true);
    setExportError(false);
    try {
      saveBlob(await api.registerCsv(query), 'student-register.csv');
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  const page = load.status === 'ready' ? load.page : undefined;
  return (
    <AppShell eyebrow="Registry workspace" title="Student register" nav={ADMIN_NAV}>
      <p className="caption">
        Passed credits use each course’s pass mark: D+ unless one is set under Settings → Course pass marks. Standing is advisory. It is shown only where a curriculum applies: a Registry-reviewed one for real students, or the illustrative synthetic rules for synthetic records. Otherwise it reads “Not determined”.
      </p>
      <div className="filters" role="group" aria-label="Filters">
        <label className="field">Programme
          <select className="input" value={query.programme ?? ''} onChange={event => update({ programme: event.target.value || undefined })}>
            <option value="">All programmes</option>
            {PROGRAMMES.map(code => <option key={code} value={code}>{code}</option>)}
          </select>
        </label>
        <label className="field">Year group
          <select className="input" value={query.yearGroup ?? ''} onChange={event => update({ yearGroup: event.target.value ? Number(event.target.value) : undefined })}>
            <option value="">All year groups</option>
            {YEAR_GROUPS.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label className="field">Standing
          <select className="input" value={query.standing ?? ''} onChange={event => update({ standing: (event.target.value || undefined) as RegisterStanding | undefined })}>
            <option value="">Any standing</option>
            {STANDING_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="field">Needs attention
          <select className="input" value={query.flag ?? ''} onChange={event => update({ flag: (event.target.value || undefined) as RegisterFlag | undefined })}>
            <option value="">Everyone</option>
            {Object.entries(FLAG_LABELS).map(([flag, label]) => <option key={flag} value={flag}>{label}</option>)}
          </select>
        </label>
        <button type="button" className="button ghost" onClick={() => void exportCsv()} disabled={exporting || !page || page.total === 0}>
          {exporting ? 'Preparing…' : 'Download CSV'}
        </button>
      </div>
      {exportError && <Notice tone="error">The CSV could not be downloaded. Try again.</Notice>}
      {selected.size > 0 && (
        <div className="selection-bar no-print" role="region" aria-label="Selected students">
          <span><strong>{selected.size}</strong> selected{selected.size > MAX_RECIPIENTS ? ` (messages go to at most ${MAX_RECIPIENTS} named students)` : ''}</span>
          {selected.size <= MAX_RECIPIENTS && <Link className="button" href={`/admin/messages/?to=${[...selected].map(encodeURIComponent).join(',')}`}>Message selected</Link>}
          <button type="button" className="link-button" onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      )}

      {page && (
        <dl className="figures register-counts">
          <div><dt>Students</dt><dd>{page.counts.students}</dd></div>
          <div><dt>Critical</dt><dd className="count-red">{page.counts.RED}</dd></div>
          <div><dt>At risk</dt><dd className="count-yellow">{page.counts.YELLOW}</dd></div>
          <div><dt>On track</dt><dd className="count-green">{page.counts.GREEN}</dd></div>
          <div><dt>Failed, not retaken</dt><dd>{page.counts.UNRESOLVED_FAILURE}</dd></div>
        </dl>
      )}

      {load.status === 'loading' && <SkeletonRows rows={8} />}
      {load.status === 'error' && <Notice tone="error">The register could not be loaded. Refresh the page to try again.</Notice>}
      {page && page.total === 0 && <p className="empty">No students match these filters.</p>}
      {page && page.total > 0 && (
        <>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Student register">
            <table className="courses register">
              <caption className="visually-hidden">Student register, sortable by column</caption>
              <thead>
                <tr>
                  <th scope="col" className="select-cell">
                    <input type="checkbox" aria-label="Select every student on this page"
                      checked={page.rows.every(row => selected.has(row.studentId))}
                      onChange={event => setSelected(current => {
                        const next = new Set(current);
                        for (const row of page.rows) if (event.target.checked) next.add(row.studentId); else next.delete(row.studentId);
                        return next;
                      })} />
                  </th>
                  {COLUMNS.map(column => (
                    <th key={column.key} scope="col" className={column.numeric ? 'num' : undefined}
                      aria-sort={query.sort === column.key ? (query.order === 'asc' ? 'ascending' : 'descending') : undefined}>
                      <button type="button" className="sort" onClick={() => sortBy(column.key)}>
                        {column.label}{query.sort === column.key ? (query.order === 'asc' ? ' ↑' : ' ↓') : ''}
                      </button>
                    </th>
                  ))}
                  <th scope="col">Attention</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map(row => (
                  <tr key={row.studentId} data-selected={selected.has(row.studentId) || undefined}>
                    <td className="select-cell">
                      <input type="checkbox" aria-label={`Select ${row.studentId}`} checked={selected.has(row.studentId)}
                        onChange={() => setSelected(current => {
                          const next = new Set(current);
                          if (next.has(row.studentId)) next.delete(row.studentId); else next.add(row.studentId);
                          return next;
                        })} />
                    </td>
                    <th scope="row"><Link className="mono" href={`/admin/?student=${encodeURIComponent(row.studentId)}`}>{row.studentId}</Link></th>
                    <td>{row.fullName}{row.synthetic && <span className="tag">Synthetic</span>}</td>
                    <td>{row.programme}</td>
                    <td className="num">{row.yearGroup}</td>
                    <td className="num">{row.passedCredits}</td>
                    <td className="num">{row.inProgressCredits}</td>
                    <td className="num">{row.unresolvedFailures}</td>
                    <td>{row.standing === 'UNDETERMINED' ? <span className="muted">Not determined</span> : <StandingBadge level={row.standing} />}</td>
                    <td>{row.flags.length ? row.flags.map(flag => <span key={flag} className={`chip ${flag === 'UNRESOLVED_FAILURE' ? 'incomplete' : 'enrolled'}`}>{FLAG_LABELS[flag]}</span>) : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="pager" aria-label="Pages">
            <button type="button" className="button ghost" disabled={page.page <= 1} onClick={() => setQuery(current => ({ ...current, page: page.page - 1 }))}>Previous</button>
            <span aria-live="polite">Page {page.page} of {page.pageCount} · {page.total} students</span>
            <button type="button" className="button ghost" disabled={page.page >= page.pageCount} onClick={() => setQuery(current => ({ ...current, page: page.page + 1 }))}>Next</button>
          </nav>
        </>
      )}
    </AppShell>
  );
}
