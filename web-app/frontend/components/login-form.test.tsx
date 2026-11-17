import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { LoginForm } from './login-form';

describe('LoginForm', () => {
  it('submits the ID and password and reports the session', async () => {
    const onSignIn = vi.fn().mockResolvedValue({ role: 'ADMIN', passwordChangeRequired: false });
    const onSuccess = vi.fn();
    render(<LoginForm onSignIn={onSignIn} onSuccess={onSuccess} />);
    await userEvent.type(screen.getByLabelText('Student or staff ID'), 'STF-1001');
    await userEvent.type(screen.getByLabelText('Password'), 'Registry-Desk-77');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSignIn).toHaveBeenCalledWith('STF-1001', 'Registry-Desk-77');
    expect(onSuccess).toHaveBeenCalledWith({ role: 'ADMIN', passwordChangeRequired: false });
  });

  it('explains failures without revealing whether the ID exists, and clears the password', async () => {
    const onSignIn = vi.fn().mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS'));
    render(<LoginForm onSignIn={onSignIn} onSuccess={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Student or staff ID'), '20289999');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('do not match an active account');
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  it('distinguishes rate limiting and network failures', async () => {
    const onSignIn = vi.fn().mockRejectedValueOnce(new ApiError(429, 'TOO_MANY_ATTEMPTS')).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<LoginForm onSignIn={onSignIn} onSuccess={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Student or staff ID'), '20280001');
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many sign-in attempts');
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be reached');
  });
});
