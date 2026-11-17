'use client';
import { useState, type FormEvent } from 'react';
import { ApiError, type Session } from '../lib/api';
import { Notice } from './app-shell';

const messages: Record<string, string> = {
  INVALID_CREDENTIALS: 'That ID and password do not match an active account. After five failed attempts the account is locked for 15 minutes.',
  TOO_MANY_ATTEMPTS: 'Too many sign-in attempts. Wait a few minutes before trying again.'
};

export function LoginForm({ onSignIn, onSuccess }: { onSignIn: (identifier: string, password: string) => Promise<Session>; onSuccess: (session: Session) => void }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      onSuccess(await onSignIn(identifier, password));
    } catch (cause) {
      setError(cause instanceof ApiError ? messages[cause.code] ?? 'Sign-in failed. Try again.' : 'The tracker could not be reached. Check your connection and try again.');
      setPassword('');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate={false}>
      <label className="field">
        Student or staff ID
        <input className="input" name="identifier" autoComplete="username" inputMode="text" required value={identifier} onChange={event => setIdentifier(event.target.value)} />
      </label>
      <label className="field">
        Password
        <input className="input" name="password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <button className="button" type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
