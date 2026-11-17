'use client';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { ADMIN_NAV, AppShell, FullPageLoading, Notice, SkeletonRows } from '../../../components/app-shell';
import { PassMarks } from '../../../components/pass-marks';
import { ApiError, type StandingThresholds } from '../../../lib/api';
import { useRequireRole, useSession } from '../../../lib/session';
import { useLoad } from '../../../lib/use-load';

const ACTIONS = [
  'AUTH_LOGIN_SUCCEEDED', 'AUTH_LOGIN_FAILED', 'AUTH_ACCOUNT_LOCKED', 'AUTH_PASSWORD_CHANGED', 'AUTH_REFRESH_REUSE_DETECTED',
  'ADMIN_PASSWORD_RESET', 'ADMIN_STUDENT_VIEWED', 'ADMIN_ELIGIBILITY_VIEWED', 'ADMIN_REGISTER_EXPORTED', 'ADMIN_REPORTS_VIEWED',
  'ADMIN_MESSAGE_SENT', 'ADMIN_IMPORT_APPLIED', 'ADMIN_IMPORT_ROLLED_BACK', 'ADMIN_SETTINGS_UPDATED', 'ADMIN_PASS_MARK_UPDATED',
  'ADMIN_USER_CREATED', 'ADMIN_STUDENT_NOTE_ADDED', 'ADMIN_AUDIT_EXPORTED'
];
const label = (action: string) => action.toLowerCase().replaceAll('_', ' ').replace(/^\w/, char => char.toUpperCase());
const formatDate = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function Thresholds() {
  const { api } = useSession();
  const load = useLoad(() => api.settings(), true, 'settings');
  const [values, setValues] = useState<StandingThresholds | null>(null);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  useEffect(() => { if (load.status === 'ready') setValues(load.data.standing); }, [load]);
  if (load.status === 'error') return <Notice tone="error">Settings could not be loaded.</Notice>;
  if (load.status === 'loading' || !values) return <SkeletonRows rows={3} />;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!values) return;
    try {
      const saved = await api.saveThresholds(values);
      setValues(saved.standing);
      setNotice({ tone: 'info', text: 'Saved. Standing everywhere now uses these thresholds.' });
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof ApiError && cause.message !== cause.code ? cause.message : 'The thresholds could not be saved.' });
    }
  }
  const field = (key: keyof StandingThresholds, text: string, hint: string, step: number) => (
    <div className="field">
      <label htmlFor={key}>{text}</label>
      <input id={key} className="input" type="number" min={1} max={key === 'criticalFailedCourses' ? 20 : 10} step={step} required value={values[key]} aria-describedby={`${key}-hint`}
        onChange={event => setValues({ ...values, [key]: Number(event.target.value) })} />
      <small id={`${key}-hint`}>{hint}</small>
    </div>
  );
  return (
    <form className="form" onSubmit={save}>
      {field('normalLoad', 'Normal load (credits per term)', 'Needing more than this per remaining term makes a student at risk.', 0.5)}
      {field('maxLoad', 'Maximum load (credits per term)', 'Needing more than this makes standing critical.', 0.5)}
      {field('criticalFailedCourses', 'Failed courses for critical standing', 'This many required courses below their pass mark, not yet retaken, makes standing critical.', 1)}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {load.data.updatedAt && <p className="caption">Last changed {formatDate(load.data.updatedAt)}.</p>}
      <button className="button" type="submit">Save thresholds</button>
    </form>
  );
}

function Admins() {
  const { api } = useSession();
  const [version, setVersion] = useState(0);
  const load = useLoad(() => api.admins(), true, `admins-${version}`);
  const [identifier, setIdentifier] = useState('');
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await api.createAdmin(identifier.trim());
      setNotice({ tone: 'info', text: `Created ${created.identifier}. Temporary password: ${created.temporaryPassword} — share it privately. It must be changed at first sign-in and is not shown again.` });
      setIdentifier('');
      setVersion(current => current + 1);
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof ApiError && cause.message !== cause.code ? cause.message : 'The account could not be created.' });
    }
  }
  return (
    <>
      {load.status === 'loading' && <SkeletonRows rows={2} />}
      {load.status === 'ready' && (
        <ul className="admin-list">
          {load.data.admins.map(admin => (
            <li key={admin.id}>
              <span className="mono">{admin.identifier}</span>
              {admin.forcePasswordChange && <span className="tag">Awaiting first sign-in</span>}
              {admin.lockedUntil && new Date(admin.lockedUntil) > new Date() && <span className="tag high">Locked</span>}
            </li>
          ))}
        </ul>
      )}
      <form className="form inline-form" onSubmit={create}>
        <label className="field">New administrator’s staff ID
          <input className="input mono" required value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="STF-1234" />
        </label>
        <button className="button" type="submit">Create administrator</button>
      </form>
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
    </>
  );
}

function AuditLog() {
  const { api } = useSession();
  const [action, setAction] = useState('');
  const load = useLoad(() => api.auditLog({ limit: 100, action: action || undefined }), true, `audit-${action}`);
  return (
    <>
      <label className="field audit-filter">Activity
        <select className="input" value={action} onChange={event => setAction(event.target.value)}>
          <option value="">All activity</option>
          {ACTIONS.map(name => <option key={name} value={name}>{label(name)}</option>)}
        </select>
      </label>
      {load.status === 'loading' && <SkeletonRows rows={5} />}
      {load.status === 'error' && <Notice tone="error">The audit log could not be loaded.</Notice>}
      {load.status === 'ready' && load.data.entries.length === 0 && <p className="empty">No matching activity.</p>}
      {load.status === 'ready' && load.data.entries.length > 0 && (
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Audit log entries">
          <table className="courses">
            <caption className="visually-hidden">Latest 100 audit log entries</caption>
            <thead><tr><th scope="col">When</th><th scope="col">Activity</th><th scope="col">By</th><th scope="col">Subject</th><th scope="col">Details</th></tr></thead>
            <tbody>
              {load.data.entries.map((entry, index) => (
                <tr key={`${entry.at}-${index}`}>
                  <td className="nowrap">{formatDate(entry.at)}</td>
                  <td>{label(entry.action)}</td>
                  <td className="mono">{entry.actorIdentifier ?? (entry.actorRole ? entry.actorRole.toLowerCase() : '—')}</td>
                  <td className="mono">{entry.subject ?? '—'}</td>
                  <td className="muted details">{entry.metadata ? Object.entries(entry.metadata).map(([key, value]) => `${key}: ${value}`).join(' · ') : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="caption">Showing the latest 100 entries. Viewing the log is itself recorded.</p>
    </>
  );
}

function PassMarksSection() {
  const { api } = useSession();
  return <PassMarks api={api} />;
}

export default function SettingsPage() {
  const session = useRequireRole('ADMIN');
  if (!session) return <FullPageLoading />;
  return (
    <AppShell eyebrow="Registry workspace" title="Settings" nav={ADMIN_NAV}>
      <div className="messages-layout">
        <section aria-labelledby="thresholds-heading">
          <h2 id="thresholds-heading" className="section-title">Standing thresholds</h2>
          <p className="caption">Used for every student’s standing, the register, reports and standing-based messages. See the severity model in the project docs.</p>
          <Thresholds />
        </section>
        <section aria-labelledby="admins-heading">
          <h2 id="admins-heading" className="section-title">Administrators</h2>
          <Admins />
          <h3 className="subhead">Your account</h3>
          <p className="caption">Changing your password signs you out on every other device.</p>
          <Link className="button ghost" href="/change-password/">Change your password</Link>
        </section>
      </div>
      <section aria-labelledby="pass-marks-heading" className="report-section">
        <h2 id="pass-marks-heading" className="section-title">Course pass marks</h2>
        <p className="caption">The minimum grade that passes each course. Set C only where the Registry has confirmed it. Changes apply at once to every audit, the register and reports, and are recorded in the audit log.</p>
        <PassMarksSection />
      </section>
      <section aria-labelledby="audit-heading" className="report-section">
        <h2 id="audit-heading" className="section-title">Audit log</h2>
        <AuditLog />
      </section>
    </AppShell>
  );
}
