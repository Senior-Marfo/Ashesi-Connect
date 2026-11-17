'use client';
import type { ReactNode } from 'react';
import { useSession } from '../lib/session';

export function AppShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  const { signOut } = useSession();
  return (
    <div className="shell">
      <header className="topbar">
        <span className="wordmark">Ashesi <em>Graduation Tracker</em></span>
        <button type="button" className="button ghost" onClick={() => void signOut()}>Sign out</button>
      </header>
      <main className="page" id="main">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display">{title}</h1>
        {children}
      </main>
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error'; children: ReactNode }) {
  return <div className={`notice ${tone}`} role={tone === 'error' ? 'alert' : 'note'}>{children}</div>;
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => <div key={index} className="skeleton" />)}
    </div>
  );
}

export function FullPageLoading() {
  return <div className="centered" aria-busy="true"><span className="spinner" aria-label="Loading" /></div>;
}
