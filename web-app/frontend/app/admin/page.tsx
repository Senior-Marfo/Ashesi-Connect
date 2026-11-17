'use client';
import { useEffect, useState } from 'react';
import { ADMIN_NAV, AppShell, FullPageLoading, Notice, SkeletonRows } from '../../components/app-shell';
import { CurriculumCatalogue, type CatalogueLoad } from '../../components/curriculum-catalogue';
import { RequirementTree } from '../../components/requirements';
import { StatusCard } from '../../components/standing';
import { StudentProfile } from '../../components/student-record';
import { ApiError, type Eligibility } from '../../lib/api';
import type { StudentRecord, StudentSummary } from '../../lib/api';
import { useRequireRole, useSession } from '../../lib/session';

type Results = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; students: StudentSummary[] };
type Profile = { status: 'none' | 'loading' | 'error' } | { status: 'ready'; record: StudentRecord; eligibility?: Eligibility };

const ID_FRAGMENT = /^[\w-]*$/;

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
  const validQuery = ID_FRAGMENT.test(query.trim());

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

  useEffect(() => {
    if (!selected) return;
    let active = true;
    setProfile({ status: 'loading' });
    api.studentRecord(selected)
      .then(async record => {
        const eligibility = await api.studentEligibility(selected).catch(() => undefined);
        if (active) setProfile({ status: 'ready', record, eligibility });
      })
      .catch(() => { if (active) setProfile({ status: 'error' }); });
    return () => { active = false; };
  }, [api, selected]);

  if (!session) return <FullPageLoading />;

  return (
    <AppShell eyebrow="Registry workspace" title="Student lookup" nav={ADMIN_NAV}>
      <div className="workspace">
        <section aria-labelledby="search-heading">
          <h2 id="search-heading" className="visually-hidden">Search</h2>
          <div className="field">
            <label htmlFor="student-search">Student ID</label>
            <input id="student-search" className="input mono" inputMode="numeric" autoComplete="off" aria-describedby="search-hint" value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. 2028" />
            <small id="search-hint">Type the start of an ID. Every lookup is recorded in the audit log.</small>
          </div>
          {!validQuery && <Notice tone="error">IDs contain only letters, digits and hyphens.</Notice>}
          {results.status === 'loading' && <SkeletonRows rows={3} />}
          {results.status === 'error' && <Notice tone="error">Search failed. Try again.</Notice>}
          {results.status === 'ready' && results.students.length === 0 && <p className="caption">No students match “{query.trim()}”.</p>}
          {results.status === 'ready' && results.students.length > 0 && (
            <ul className="results">
              {results.students.map(student => (
                <li key={student.studentId}>
                  <button type="button" aria-current={student.studentId === selected} onClick={() => setSelected(student.studentId)}>
                    <span className="mono">{student.studentId}</span>
                    <small>{student.fullName} · {student.programme} {student.yearGroup}{student.synthetic ? ' · Synthetic' : ''}</small>
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
                <button type="button" className="button ghost" onClick={() => void issuePassword(profile.record.student.studentId)}>Issue temporary password</button>
              </div>
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
            </>
          )}
        </section>
      </div>
      <CurriculumCatalogue load={catalogue} />
    </AppShell>
  );
}
