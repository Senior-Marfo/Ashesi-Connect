'use client';
import { useEffect, useState, type FormEvent } from 'react';
import type { ApiClient, InboxItem, StudentNote } from '../lib/api';
import { Notice, SkeletonRows } from './app-shell';

type Load<T> = { status: 'loading' | 'error' } | { status: 'ready'; items: T[] };

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const NOTE_LIMIT = 2000;

/** US-06: staff-only notes and the messages this student has received. Students never see this panel. */
export function StaffPanel({ api, studentId }: { api: Pick<ApiClient, 'studentNotes' | 'addStudentNote' | 'studentMessages'>; studentId: string }) {
  const [notes, setNotes] = useState<Load<StudentNote>>({ status: 'loading' });
  const [messages, setMessages] = useState<Load<InboxItem>>({ status: 'loading' });
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    let active = true;
    setNotes({ status: 'loading' });
    setMessages({ status: 'loading' });
    setDraft('');
    api.studentNotes(studentId)
      .then(({ notes: items }) => { if (active) setNotes({ status: 'ready', items }); })
      .catch(() => { if (active) setNotes({ status: 'error' }); });
    api.studentMessages(studentId)
      .then(({ messages: items }) => { if (active) setMessages({ status: 'ready', items }); })
      .catch(() => { if (active) setMessages({ status: 'error' }); });
    return () => { active = false; };
  }, [api, studentId]);

  async function addNote(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setSaving(true);
    setSaveError(false);
    try {
      const { note } = await api.addStudentNote(studentId, draft.trim());
      setNotes(current => ({ status: 'ready', items: [note, ...(current.status === 'ready' ? current.items : [])] }));
      setDraft('');
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="staff-panel">
      <section aria-labelledby="notes-heading">
        <h3 id="notes-heading">Staff notes</h3>
        <p className="caption">Visible to administrators only. Each note is recorded in the audit log and cannot be edited.</p>
        <form className="no-print" onSubmit={event => void addNote(event)}>
          <div className="field">
            <label htmlFor="note-body">New note</label>
            <textarea id="note-body" className="input textarea" rows={3} maxLength={NOTE_LIMIT} value={draft} onChange={event => setDraft(event.target.value)} aria-describedby="note-count" />
            <small id="note-count">{draft.length} / {NOTE_LIMIT}</small>
          </div>
          <button type="submit" className="button" disabled={saving || !draft.trim()}>{saving ? 'Saving…' : 'Add note'}</button>
          {saveError && <Notice tone="error">The note could not be saved. Try again.</Notice>}
        </form>
        {notes.status === 'loading' && <SkeletonRows rows={2} />}
        {notes.status === 'error' && <Notice tone="error">Notes could not be loaded.</Notice>}
        {notes.status === 'ready' && notes.items.length === 0 && <p className="empty">No notes yet.</p>}
        {notes.status === 'ready' && notes.items.length > 0 && (
          <ol className="timeline">
            {notes.items.map(note => (
              <li key={note.id}>
                <p className="timeline-body">{note.body}</p>
                <p className="muted"><span className="mono">{note.author}</span> · <time dateTime={note.createdAt}>{when(note.createdAt)}</time></p>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section aria-labelledby="history-heading">
        <h3 id="history-heading">Messages received</h3>
        {messages.status === 'loading' && <SkeletonRows rows={2} />}
        {messages.status === 'error' && <Notice tone="error">Message history could not be loaded.</Notice>}
        {messages.status === 'ready' && messages.items.length === 0 && <p className="empty">No messages sent to this student yet.</p>}
        {messages.status === 'ready' && messages.items.length > 0 && (
          <ol className="timeline">
            {messages.items.map(message => (
              <li key={message.id}>
                <p className="timeline-title">
                  {message.title}
                  {message.priority === 'HIGH' && <span className="tag high">High priority</span>}
                </p>
                <p className="muted">
                  Sent <time dateTime={message.sentAt}>{when(message.sentAt)}</time> · {message.readAt ? <>Read <time dateTime={message.readAt}>{when(message.readAt)}</time></> : <strong>Unread</strong>}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
