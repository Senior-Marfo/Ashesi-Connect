'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { FullPageLoading, Notice } from '../../components/app-shell';
import { ApiError } from '../../lib/api';
import { homeFor, useSession } from '../../lib/session';

export default function ChangePasswordPage() {
  const { state, changePassword, signOut } = useSession();
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (state.status === 'anonymous') router.replace('/');
  }, [router, state.status]);

  if (state.status !== 'authenticated') return <FullPageLoading />;
  const required = state.session.passwordChangeRequired;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (next !== confirm) {
      setError('The new passwords do not match.');
      return;
    }
    setPending(true);
    try {
      const session = await changePassword(current, next);
      router.replace(homeFor(session.role));
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'WEAK_PASSWORD') setError(cause.message);
      else if (cause instanceof ApiError && cause.code === 'INVALID_CREDENTIALS') setError('Your current password is incorrect.');
      else setError('The password could not be changed. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth">
      <main className="auth-panel" id="main">
        <p className="eyebrow">Account security</p>
        <h1 className="display">{required ? 'Set a new password' : 'Change password'}</h1>
        <p className="lede">
          {required ? 'Your account has a temporary password. Choose a new one to continue.' : 'Changing your password signs you out on every other device.'}
        </p>
        <form className="form" onSubmit={submit}>
          <label className="field">
            {required ? 'Temporary password' : 'Current password'}
            <input className="input" type="password" autoComplete="current-password" required value={current} onChange={event => setCurrent(event.target.value)} />
          </label>
          <div className="field">
            <label htmlFor="new-password">New password</label>
            <input id="new-password" className="input" type="password" autoComplete="new-password" required minLength={12} aria-describedby="password-rules" value={next} onChange={event => setNext(event.target.value)} />
            <small id="password-rules">At least 12 characters, mixing three of: lowercase, uppercase, digits, symbols. Must not contain your ID.</small>
          </div>
          <label className="field">
            Confirm new password
            <input className="input" type="password" autoComplete="new-password" required value={confirm} onChange={event => setConfirm(event.target.value)} />
          </label>
          {error && <Notice tone="error">{error}</Notice>}
          <button className="button" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save new password'}</button>
          <button className="button ghost" type="button" onClick={() => void signOut()}>Sign out</button>
        </form>
      </main>
    </div>
  );
}
