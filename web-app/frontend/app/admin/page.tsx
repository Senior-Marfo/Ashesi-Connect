'use client';
import { useEffect, useState } from 'react';
import { ADMIN_NAV, AppShell, FullPageLoading, Notice, SkeletonRows } from '../../components/app-shell';
import { CurriculumCatalogue, type CatalogueLoad } from '../../components/curriculum-catalogue';
import { RequirementTree } from '../../components/requirements';
import { StatusCard } from '../../components/standing';
import { RecordEditor } from '../../components/record-editor';
import { StaffPanel } from '../../components/staff-panel';
import { StudentProfile } from '../../components/student-record';
import { ApiError, type Eligibility } from '../../lib/api';
import type { SearchMatch, StudentRecord, StudentSearchResult } from '../../lib/api';
import { forgetRecentStudents, loadRecentStudents, rememberStudent, type RecentStudent } from '../../lib/recent-students';
import { useRequireRole, useSession } from '../../lib/session';

type Results = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; students: StudentSearchResult[] };
type Profile = { status: 'none' | 'loading' | 'error' } | { status: 'ready'; record: StudentRecord; eligibility?: Eligibility };

const ID_FRAGMENT = /^[\w-]*$/;
const SEARCH_TEXT = /^[\p{L}\p{N}\s'.-]*$/u;
const CLOSE_MATCH: Partial<Record<SearchMatch, string>> = { CLOSE_ID: 'Close ID match', CLOSE_NAME: 'Close name match' };

export default function AdminPage() {
  const session = useRequireRole('ADMIN');
  const { api } = useSession();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Results>({ status: 'idle' });
  const [selected, setSelected] = useState<string>();
  const [profile, setProfile] = useState<Profile>({ status: 'none' });
  const [temporary, setTemporary] = useState<{ studentId: string; text: string; tone: 'info' | 'error' } | null>(null);

  async function issuePassword(studentId: string) {
    if (!window.confirm(`Issue a temporary password for ${studentId}? Their current password and sessions stop working.`)) return;
    try {
      const { temporaryPassword } = await api.issueTemporaryPassword(studentId);
      setTemporary({ studentId, tone: 'info', text: `Temporary password for ${studentId}: ${temporaryPassword} — share it privately. It must be changed at first sign-in and is not shown again.` });
    } catch (cause) {
      setTemporary({ studentId, tone: 'error', text: cause instanceof ApiError && cause.code === 'USER_NOT_FOUND' ? `${studentId} has no sign-in account.` : 'A temporary password could not be issued.' });
    }
  }
  const [catalogue, setCatalogue] = useState<CatalogueLoad>({ status: 'loading' });
  const [recent, setRecent] = useState<RecentStudent[]>([]);
  const [exportError, setExportError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reloads, setReloads] = useState(0);
  const validQuery = SEARCH_TEXT.test(query.trim());

  useEffect(() => { setRecent(loadRecentStudents()); }, []);

  async function exportAudit(studentId: string) {
    setExportError(false);
    try {
      await api.recordAuditExport(studentId);
      // The printed audit carries the full requirement tree, not just its summary line.
      document.querySelectorAll<HTMLDetailsElement>('details.admin-requirements').forEach(details => { details.open = true; });
      window.print();
    } catch {
      setExportError(true);
    }
  }

  useEffect(() => {
    const term = query.trim();
    if (!session || !term || !validQuery) {
      setResults({ status: 'idle' });
      return;
    }
    let active = true;
    setResults({ status: 'loading' });
    const timer = setTimeout(() => {
      api.searchStudents(term)
        .then(({ students }) => { if (active) setResults({ status: 'ready', students }); })
        .catch(() => { if (active) setResults({ status: 'error' }); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [api, query, session, validQuery]);

  // The register links here with ?student=<id> to open a record directly.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('student');
    if (requested && ID_FRAGMENT.test(requested)) {
      setQuery(requested);
      setSelected(requested);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;
    api.curricula()
      .then(({ curricula }) => { if (active) setCatalogue({ status: 'ready', curricula }); })
      .catch(() => { if (active) setCatalogue({ status: 'error' }); });
    return () => { active = false; };
  }, [api, session]);

  useEffect(() => { setEditing(false); }, [selected]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    // A reload after an edit keeps the current record on screen until the fresh one arrives.
    setProfile(current => (current.status === 'ready' && current.record.student.studentId === selected ? current : { status: 'loading' }));
    api.studentRecord(selected)
      .then(async record => {
        const eligibility = await api.studentEligibility(selected).catch(() => undefined);
        if (!active) return;
        setProfile({ status: 'ready', record, eligibility });
        setRecent(rememberStudent(record.student));
      })
      .catch(() => { if (active) setProfile({ status: 'error' }); });
    return () => { active = false; };
  }, [api, selected, reloads]);

  if (!session) return <FullPageLoading />;

  return (
    <AppShell eyebrow="Registry workspace" title="Student lookup" nav={ADMIN_NAV}>
      <div className="workspace">
        <section aria-labelledby="search-heading" className="no-print">
          <h2 id="search-heading" className="visually-hidden">Search</h2>
          <div className="field">
            <label htmlFor="student-search">Student ID or name</label>
            <input id="student-search" className="input" type="search" autoComplete="off" spellCheck={false} aria-describedby="search-hint" value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. 2028 or Mensah" />
            <small id="search-hint">Type the start of an ID or any part of a name. Close matches appear when nothing matches exactly. Every lookup is recorded in the audit log.</small>
          </div>
          {!validQuery && <Notice tone="error">Search with letters, digits, spaces, hyphens or apostrophes only.</Notice>}
          {!query.trim() && recent.length > 0 && (
            <div className="recent">
              <div className="recent-head">
                <h3>Recently opened</h3>
                <button type="button" className="link-button" onClick={() => { forgetRecentStudents(); setRecent([]); }}>Clear</button>
              </div>
              <ul className="results">
                {recent.map(student => (
                  <li key={student.studentId}>
                    <button type="button" aria-current={student.studentId === selected} onClick={() => setSelected(student.studentId)}>
                      <span className="mono">{student.studentId}</span>
                      <small>{student.fullName}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {results.status === 'loading' && <SkeletonRows rows={3} />}
          {results.status === 'error' && <Notice tone="error">Search failed. Try again.</Notice>}
          {results.status === 'ready' && results.students.length === 0 && <p className="caption">No students match “{query.trim()}”, even allowing for a typo.</p>}
          {results.status === 'ready' && results.students.length > 0 && CLOSE_MATCH[results.students[0].match] && <p className="caption">Nothing matches exactly. Did you mean one of these?</p>}
          {results.status === 'ready' && results.students.length > 0 && (
            <ul className="results">
              {results.students.map(student => (
                <li key={student.studentId}>
                  <button type="button" aria-current={student.studentId === selected} onClick={() => setSelected(student.studentId)}>
                    <span className="mono">{student.studentId}</span>
                    <small>{student.fullName} · {student.programme} {student.yearGroup}{student.synthetic ? ' · Synthetic' : ''}</small>
                    {CLOSE_MATCH[student.match] && <small className="match-kind">{CLOSE_MATCH[student.match]}</small>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-live="polite" aria-labelledby="profile-heading">
          {profile.status === 'none' && <p className="empty" id="profile-heading">Search for a student and select them to see their record.</p>}
          {profile.status === 'loading' && <SkeletonRows rows={6} />}
          {profile.status === 'error' && <Notice tone="error">This record could not be loaded.</Notice>}
          {profile.status === 'ready' && (
            <>
              <div className="report-head">
                <h2 className="profile-title" id="profile-heading">{profile.record.student.fullName}</h2>
                <div className="actions no-print">
                  <button type="button" className="button ghost" aria-expanded={editing} onClick={() => setEditing(current => !current)}>{editing ? 'Close editor' : 'Edit record'}</button>
                  <button type="button" className="button ghost" onClick={() => void exportAudit(profile.record.student.studentId)}>Print or save audit PDF</button>
                  <button type="button" className="button ghost" onClick={() => void issuePassword(profile.record.student.studentId)}>Issue temporary password</button>
                </div>
              </div>
              <p className="print-only caption">Graduation audit printed {new Date().toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}. Advisory only: not an official Registry certification.</p>
              {exportError && <Notice tone="error">The export could not be recorded, so it was not started. Try again.</Notice>}
              {editing && (
                <div className="no-print">
                  <RecordEditor api={api} student={profile.record.student} courses={profile.record.courses} onSaved={() => setReloads(count => count + 1)} />
                </div>
              )}
              {temporary?.studentId === profile.record.student.studentId && <div className="synthetic-notice"><Notice tone={temporary.tone}>{temporary.text}</Notice></div>}
              <StudentProfile record={profile.record} passMarks={profile.eligibility && Object.fromEntries(profile.eligibility.requirements.flatMap(group => group.items.map(item => [item.code, item.minimumGrade])))}>
                {profile.eligibility
                  ? <>
                      <StatusCard eligibility={profile.eligibility} />
                      {profile.eligibility.requirements.length > 0 && (
                        <details className="admin-requirements">
                          <summary>All requirements</summary>
                          <RequirementTree groups={profile.eligibility.requirements} />
                        </details>
                      )}
                    </>
                  : <Notice tone="error">Graduation status could not be loaded for this student.</Notice>}
              </StudentProfile>
              <StaffPanel api={api} studentId={profile.record.student.studentId} />
            </>
          )}
        </section>
      </div>
      <div className="no-print"><CurriculumCatalogue load={catalogue} /></div>
    </AppShell>
  );
}
