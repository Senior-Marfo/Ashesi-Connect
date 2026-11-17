'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { FullPageLoading } from '../components/app-shell';
import { LoginForm } from '../components/login-form';
import type { Session } from '../lib/api';
import { homeFor, useSession } from '../lib/session';

const destinationFor = (session: Session) => (session.passwordChangeRequired ? '/change-password/' : homeFor(session.role));

export default function SignInPage() {
  const { state, signIn } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'authenticated') router.replace(destinationFor(state.session));
  }, [router, state]);

  if (state.status !== 'anonymous') return <FullPageLoading />;

  return (
    <div className="auth">
      <main className="auth-panel" id="main">
        <p className="eyebrow">Ashesi University</p>
        <h1 className="display">Graduation Tracker</h1>
        <p className="lede">Sign in with your student ID or staff ID. Your role is determined by your account.</p>
        <LoginForm onSignIn={signIn} onSuccess={session => router.replace(destinationFor(session))} />
      </main>
      <aside className="auth-aside" aria-hidden="true">
        <blockquote>Know exactly where you stand on the path to graduation.</blockquote>
        <p>Requirements, grades and credits in one place, for students and the Registry.</p>
      </aside>
    </div>
  );
}
