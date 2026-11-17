'use client';
import { useState } from 'react';
import { AppShell, FullPageLoading, Notice, SkeletonRows, useStudentNav } from '../../../components/app-shell';
import type { InboxItem } from '../../../lib/api';
import { useRequireRole, useSession } from '../../../lib/session';
import { useLoad } from '../../../lib/use-load';

const formatDate = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** US-12: messages from the Registry, newest first; opening one marks it read. */
export default function InboxPage() {
  const session = useRequireRole('STUDENT');
  const { api } = useSession();
  const [version, setVersion] = useState(0);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [navVersion, setNavVersion] = useState(0);
  const load = useLoad(() => api.inbox(), Boolean(session), `inbox-${version}`);
  // The badge refreshes only after the server has recorded the read.
  const nav = useStudentNav(navVersion);
  if (!session) return <FullPageLoading />;

  const isRead = (message: InboxItem) => Boolean(message.readAt) || readIds.has(message.id);
  async function open(message: InboxItem) {
    if (isRead(message)) return;
    setReadIds(current => new Set(current).add(message.id));
    await api.markRead(message.id).catch(() => undefined);
    setNavVersion(current => current + 1);
  }
  async function markAll() {
    await api.markAllRead().catch(() => undefined);
    setVersion(current => current + 1);
    setNavVersion(current => current + 1);
  }

  const messages = load.status === 'ready' ? load.data.messages : [];
  const unread = messages.filter(message => !isRead(message)).length;
  return (
    <AppShell eyebrow="Messages from the Registry" title="Inbox" nav={nav}>
      {load.status === 'loading' && <SkeletonRows rows={5} />}
      {load.status === 'error' && <Notice tone="error">Your messages could not be loaded. Refresh the page to try again.</Notice>}
      {load.status === 'ready' && messages.length === 0 && <p className="empty">No messages yet. Registry announcements and reminders will appear here.</p>}
      {messages.length > 0 && (
        <>
          <div className="inbox-tools">
            <span className="muted" aria-live="polite">{unread === 0 ? 'All caught up' : `${unread} unread`}</span>
            <button type="button" className="button ghost" onClick={() => void markAll()} disabled={unread === 0}>Mark all as read</button>
          </div>
          <ul className="inbox">
            {messages.map(message => (
              <li key={message.id} className={isRead(message) ? 'read' : 'unread'}>
                <details onToggle={event => { if ((event.target as HTMLDetailsElement).open) void open(message); }}>
                  <summary>
                    <span className="dot" aria-hidden="true" />
                    <span className="inbox-title">{message.title}{!isRead(message) && <span className="visually-hidden"> (unread)</span>}</span>
                    {message.priority === 'HIGH' && <span className="tag high">High priority</span>}
                    <time dateTime={message.sentAt} className="muted">{formatDate(message.sentAt)}</time>
                  </summary>
                  <p className="inbox-body">{message.body}</p>
                </details>
              </li>
            ))}
          </ul>
        </>
      )}
    </AppShell>
  );
}
