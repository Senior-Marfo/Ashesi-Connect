'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { ADMIN_NAV, AppShell, FullPageLoading, Notice, SkeletonRows } from '../../../components/app-shell';
import { MeterList } from '../../../components/charts';
import { ApiError, type MessageAudience, type MessagePriority, type SentMessage } from '../../../lib/api';
import { standingLabels } from '../../../lib/labels';
import { useRequireRole, useSession } from '../../../lib/session';
import { useLoad } from '../../../lib/use-load';

const PROGRAMMES = ['BA', 'ECON', 'LLB', 'MIS', 'CS', 'CE', 'EE', 'ME', 'MT', 'BE'];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_GROUPS = Array.from({ length: 6 }, (_, index) => CURRENT_YEAR - 1 + index);
type AudienceKind = MessageAudience['kind'];

function describeAudience(audience: MessageAudience): string {
  switch (audience.kind) {
    case 'ALL_STUDENTS': return 'All students';
    case 'PROGRAMME': return `Programme ${audience.programme}`;
    case 'YEAR_GROUP': return `Year group ${audience.yearGroup}`;
    case 'STANDING': return `Standing: ${standingLabels[audience.standing].toLowerCase()}`;
    case 'STUDENTS': return `${audience.studentIds.length} selected student${audience.studentIds.length === 1 ? '' : 's'}`;
  }
}

/** US-11: compose, target and send messages, then follow how many were read. */
export default function MessagesPage() {
  const session = useRequireRole('ADMIN');
  const { api } = useSession();
  const [sentVersion, setSentVersion] = useState(0);
  const templates = useLoad(() => api.messageTemplates(), Boolean(session), 'templates');
  const sent = useLoad(() => api.sentMessages(), Boolean(session), `sent-${sentVersion}`);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<MessagePriority>('NORMAL');
  const [kind, setKind] = useState<AudienceKind>('ALL_STUDENTS');
  const [programme, setProgramme] = useState('CS');
  const [yearGroup, setYearGroup] = useState(CURRENT_YEAR + 1);
  const [standing, setStanding] = useState<'RED' | 'YELLOW' | 'GREEN'>('RED');
  const [ids, setIds] = useState('');
  const [preview, setPreview] = useState<{ recipientCount: number; unknownIds: string[] } | null>(null);
  const [status, setStatus] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  const studentIds = ids.split(/[\s,;]+/).map(id => id.trim()).filter(Boolean);
  const audience: MessageAudience =
    kind === 'PROGRAMME' ? { kind, programme }
    : kind === 'YEAR_GROUP' ? { kind, yearGroup }
    : kind === 'STANDING' ? { kind, standing }
    : kind === 'STUDENTS' ? { kind, studentIds }
    : { kind: 'ALL_STUDENTS' };
  const audienceKey = JSON.stringify(audience);

  useEffect(() => {
    if (!session || (audience.kind === 'STUDENTS' && audience.studentIds.length === 0)) {
      setPreview(null);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      api.previewAudience(audience).then(result => { if (active) setPreview(result); }).catch(() => { if (active) setPreview(null); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
    // audienceKey captures every audience field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, audienceKey, session]);

  if (!session) return <FullPageLoading />;

  function applyTemplate(id: string) {
    const template = templates.status === 'ready' ? templates.data.templates.find(candidate => candidate.id === id) : undefined;
    if (!template) return;
    setTitle(template.title);
    setBody(template.body);
    setPriority(template.priority);
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!preview || preview.recipientCount === 0) return;
    if (!window.confirm(`Send “${title.trim()}” to ${preview.recipientCount} student${preview.recipientCount === 1 ? '' : 's'}?`)) return;
    setSending(true);
    setStatus(null);
    try {
      const result = await api.sendMessage({ title, body, priority, audience });
      setStatus({ tone: 'info', text: `Sent to ${result.message.recipientCount} student${result.message.recipientCount === 1 ? '' : 's'}.${result.unknownIds.length ? ` Unknown IDs skipped: ${result.unknownIds.join(', ')}.` : ''}` });
      setTitle('');
      setBody('');
      setPriority('NORMAL');
      setSentVersion(current => current + 1);
    } catch (cause) {
      setStatus({ tone: 'error', text: cause instanceof ApiError && cause.code === 'NO_RECIPIENTS' ? 'Nobody matches this audience.' : 'The message could not be sent. Check the fields and try again.' });
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell eyebrow="Registry workspace" title="Messages" nav={ADMIN_NAV}>
      <div className="messages-layout">
        <form className="form compose" onSubmit={send} aria-labelledby="compose-heading">
          <h2 id="compose-heading" className="section-title">New message</h2>
          {templates.status === 'ready' && (
            <label className="field">Start from a template
              <select className="input" defaultValue="" onChange={event => applyTemplate(event.target.value)}>
                <option value="">Blank message</option>
                {templates.data.templates.map(template => <option key={template.id} value={template.id}>{template.title}</option>)}
              </select>
            </label>
          )}
          <label className="field">Title
            <input className="input" required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} />
          </label>
          <label className="field">Message
            <textarea className="input textarea" required maxLength={5000} rows={7} value={body} onChange={event => setBody(event.target.value)} />
          </label>
          <fieldset className="field radios">
            <legend>Priority</legend>
            <label><input type="radio" name="priority" checked={priority === 'NORMAL'} onChange={() => setPriority('NORMAL')} /> Normal</label>
            <label><input type="radio" name="priority" checked={priority === 'HIGH'} onChange={() => setPriority('HIGH')} /> High</label>
          </fieldset>
          <label className="field">Send to
            <select className="input" value={kind} onChange={event => setKind(event.target.value as AudienceKind)}>
              <option value="ALL_STUDENTS">All students</option>
              <option value="PROGRAMME">A programme</option>
              <option value="YEAR_GROUP">A year group</option>
              <option value="STANDING">Students with a standing</option>
              <option value="STUDENTS">Specific student IDs</option>
            </select>
          </label>
          {kind === 'PROGRAMME' && (
            <label className="field">Programme
              <select className="input" value={programme} onChange={event => setProgramme(event.target.value)}>{PROGRAMMES.map(code => <option key={code}>{code}</option>)}</select>
            </label>
          )}
          {kind === 'YEAR_GROUP' && (
            <label className="field">Year group
              <select className="input" value={yearGroup} onChange={event => setYearGroup(Number(event.target.value))}>{YEAR_GROUPS.map(year => <option key={year}>{year}</option>)}</select>
            </label>
          )}
          {kind === 'STANDING' && (
            <label className="field">Standing
              <select className="input" value={standing} onChange={event => setStanding(event.target.value as 'RED' | 'YELLOW' | 'GREEN')}>
                <option value="RED">Critical</option><option value="YELLOW">At risk</option><option value="GREEN">On track</option>
              </select>
            </label>
          )}
          {kind === 'STUDENTS' && (
            <label className="field">Student IDs
              <textarea className="input textarea mono" rows={3} value={ids} onChange={event => setIds(event.target.value)} placeholder="Separate with spaces, commas or new lines" />
            </label>
          )}
          <p className="recipients" aria-live="polite">
            {preview === null ? 'Choose who to send to.' : `${preview.recipientCount} recipient${preview.recipientCount === 1 ? '' : 's'}`}
            {preview && preview.unknownIds.length > 0 && <span className="muted"> · not found: {preview.unknownIds.join(', ')}</span>}
          </p>
          {status && <Notice tone={status.tone}>{status.text}</Notice>}
          <button className="button" type="submit" disabled={sending || !preview || preview.recipientCount === 0 || !title.trim() || !body.trim()}>
            {sending ? 'Sending…' : 'Send message'}
          </button>
        </form>

        <section aria-labelledby="sent-heading">
          <h2 id="sent-heading" className="section-title">Sent</h2>
          {sent.status === 'loading' && <SkeletonRows rows={4} />}
          {sent.status === 'error' && <Notice tone="error">Sent messages could not be loaded.</Notice>}
          {sent.status === 'ready' && sent.data.messages.length === 0 && <p className="empty">Nothing sent yet.</p>}
          {sent.status === 'ready' && sent.data.messages.length > 0 && (
            <ul className="sent-list">
              {sent.data.messages.map((message: SentMessage) => (
                <li key={message.id}>
                  <div className="sent-head">
                    <strong>{message.title}</strong>
                    {message.priority === 'HIGH' && <span className="tag high">High priority</span>}
                  </div>
                  <p className="muted">{describeAudience(message.audience)} · {new Date(message.sentAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  <MeterList label={`Read receipts for ${message.title}`} rows={[{ key: 'read', label: '', value: message.readCount, max: message.recipientCount, display: `${message.readCount} of ${message.recipientCount} read` }]} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
