'use client';
import { useEffect, useState } from 'react';
import { AppShell, FullPageLoading, Notice, SkeletonRows } from '../../components/app-shell';
import { StudentProfile } from '../../components/student-record';
import type { StudentRecord, StudentSummary } from '../../lib/api';
import { useRequireRole, useSession } from '../../lib/session';

type Results = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; students: StudentSummary[] };
type Profile = { status: 'none' | 'loading' | 'error' } | { status: 'ready'; record: StudentRecord };

const ID_FRAGMENT = /^[\w-]*$/;

export default function AdminPage() {
  const session = useRequireRole('ADMIN');
  const { api } = useSession();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Results>({ status: 'idle' });
  const [selected, setSelected] = useState<string>();
  const [profile, setProfile] = useState<Profile>({ status: 'none' });
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

  useEffect(() => {
    if (!selected) return;
    let active = true;
    setProfile({ status: 'loading' });
    api.studentRecord(selected)
      .then(record => { if (active) setProfile({ status: 'ready', record }); })
      .catch(() => { if (active) setProfile({ status: 'error' }); });
    return () => { active = false; };
  }, [api, selected]);

  if (!session) return <FullPageLoading />;

  return (
    <AppShell eyebrow="Registry workspace" title="Student lookup">
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
                    <small>{student.fullName} · {student.programme} {student.yearGroup}</small>
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
              <h2 className="profile-title" id="profile-heading">{profile.record.student.fullName}</h2>
              <StudentProfile record={profile.record} />
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
