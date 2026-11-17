'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ADMIN_NAV, AppShell, FullPageLoading, Notice, SkeletonRows } from '../../../components/app-shell';
import type { RegisterFlag, RegisterPage, RegisterQuery, RegisterSort } from '../../../lib/api';
import { useRequireRole, useSession } from '../../../lib/session';

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
  { key: 'unresolvedFailures', label: 'Not retaken', numeric: true }
];

type Load = { status: 'loading' | 'error' } | { status: 'ready'; page: RegisterPage };

export default function RegisterPageView() {
  const session = useRequireRole('ADMIN');
  const { api } = useSession();
  const [query, setQuery] = useState<RegisterQuery>({ sort: 'studentId', order: 'asc', page: 1 });
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [exporting, setExporting] = useState(false);
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
    update({ sort: key, order: query.sort === key && query.order === 'asc' ? 'desc' : key === 'studentId' || key === 'fullName' || key === 'programme' ? 'asc' : 'desc' });

  async function exportCsv() {
    setExporting(true);
    setExportError(false);
    try {
      const blob = await api.registerCsv(query);
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement('a'), { href: url, download: 'student-register.csv' });
      link.click();
      URL.revokeObjectURL(url);
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
        Built from course records only. Passed credits use the provisional D+ pass mark until the Registry confirms course thresholds. Graduation standing (red, amber, green) needs a reviewed curriculum and is not shown yet.
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

      {page && (
        <dl className="figures register-counts">
          <div><dt>Students</dt><dd>{page.counts.students}</dd></div>
          <div><dt>Failed, not retaken</dt><dd>{page.counts.UNRESOLVED_FAILURE}</dd></div>
          <div><dt>Incomplete course</dt><dd>{page.counts.INCOMPLETE}</dd></div>
        </dl>
      )}

      {load.status === 'loading' && <SkeletonRows rows={8} />}
      {load.status === 'error' && <Notice tone="error">The register could not be loaded. Refresh the page to try again.</Notice>}
      {page && page.total === 0 && <p className="empty">No students match these filters.</p>}
      {page && page.total > 0 && (
        <>
          <div className="table-wrap">
            <table className="courses register">
              <caption className="visually-hidden">Student register, sortable by column</caption>
              <thead>
                <tr>
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
                  <tr key={row.studentId}>
                    <th scope="row"><Link className="mono" href={`/admin/?student=${encodeURIComponent(row.studentId)}`}>{row.studentId}</Link></th>
                    <td>{row.fullName}{row.synthetic && <span className="tag">Synthetic</span>}</td>
                    <td>{row.programme}</td>
                    <td className="num">{row.yearGroup}</td>
                    <td className="num">{row.passedCredits}</td>
                    <td className="num">{row.inProgressCredits}</td>
                    <td className="num">{row.unresolvedFailures}</td>
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
