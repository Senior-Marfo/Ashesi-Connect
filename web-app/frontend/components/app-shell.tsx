'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useSession } from '../lib/session';

export interface NavItem { href: string; label: string }

export const STUDENT_NAV: NavItem[] = [
  { href: '/student/', label: 'Status' },
  { href: '/student/requirements/', label: 'Requirements' },
  { href: '/student/remaining/', label: 'Remaining' },
  { href: '/student/courses/', label: 'Courses' }
];

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin/', label: 'Student lookup' },
  { href: '/admin/register/', label: 'Register' }
];

export function AppShell({ title, eyebrow, nav, children }: { title: string; eyebrow: string; nav?: NavItem[]; children: ReactNode }) {
  const { signOut } = useSession();
  const pathname = usePathname();
  return (
    <div className="shell">
      <header className="topbar">
        <span className="wordmark">Ashesi <em>Graduation Tracker</em></span>
        {nav && (
          <nav className="topnav" aria-label="Sections">
            {nav.map(item => (
              <Link key={item.href} href={item.href} aria-current={pathname === item.href || `${pathname}/` === item.href ? 'page' : undefined}>{item.label}</Link>
            ))}
          </nav>
        )}
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
