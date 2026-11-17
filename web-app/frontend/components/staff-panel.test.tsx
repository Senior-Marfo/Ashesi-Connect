import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { InboxItem, StudentNote } from '../lib/api';
import { StaffPanel } from './staff-panel';

const note = (id: string, body: string): StudentNote => ({ id, studentId: '20280001', body, author: 'STF-1001', createdAt: '2026-11-10T09:00:00Z' });
const message = (id: string, readAt?: string): InboxItem => ({ id, title: `Message ${id}`, body: 'Body', priority: id === '2' ? 'HIGH' : 'NORMAL', sentAt: '2026-11-01T09:00:00Z', readAt });

function fakeApi(overrides: Partial<Parameters<typeof StaffPanel>[0]['api']> = {}) {
  return {
    studentNotes: vi.fn().mockResolvedValue({ notes: [note('n1', 'Discussed MATH 141 retake.')] }),
    addStudentNote: vi.fn().mockImplementation(async (_id: string, body: string) => ({ note: note('n2', body) })),
    studentMessages: vi.fn().mockResolvedValue({ messages: [message('1', '2026-11-02T09:00:00Z'), message('2')] }),
    ...overrides
  };
}

describe('StaffPanel', () => {
  it('lists notes with their author and the messages received with read state', async () => {
    render(<StaffPanel api={fakeApi()} studentId="20280001" />);
    const notes = await screen.findByRole('region', { name: 'Staff notes' });
    expect(await within(notes).findByText('Discussed MATH 141 retake.')).toBeVisible();
    expect(within(notes).getByText('STF-1001')).toBeVisible();
    const history = screen.getByRole('region', { name: 'Messages received' });
    expect(await within(history).findByText('Message 1')).toBeVisible();
    const [first, second] = within(history).getAllByRole('listitem');
    expect(first).toHaveTextContent(/· Read /);
    expect(second).toHaveTextContent(/· Unread$/);
    expect(within(history).getByText('High priority')).toBeVisible();
  });

  it('adds a trimmed note to the top of the list and clears the draft', async () => {
    const api = fakeApi();
    render(<StaffPanel api={api} studentId="20280001" />);
    await screen.findByText('Discussed MATH 141 retake.');
    const button = screen.getByRole('button', { name: 'Add note' });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText('New note'), '  Capstone confirmed.  ');
    await userEvent.click(button);
    expect(api.addStudentNote).toHaveBeenCalledWith('20280001', 'Capstone confirmed.');
    const items = within(screen.getByRole('region', { name: 'Staff notes' })).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Capstone confirmed.');
    expect(screen.getByLabelText('New note')).toHaveValue('');
  });

  it('shows empty states and errors without hiding the rest of the panel', async () => {
    render(<StaffPanel api={fakeApi({
      studentNotes: vi.fn().mockResolvedValue({ notes: [] }),
      studentMessages: vi.fn().mockRejectedValue(new Error('offline')),
      addStudentNote: vi.fn().mockRejectedValue(new Error('offline'))
    })} studentId="20280001" />);
    expect(await screen.findByText('No notes yet.')).toBeVisible();
    expect(await screen.findByText('Message history could not be loaded.')).toBeVisible();
    await userEvent.type(screen.getByLabelText('New note'), 'Hello');
    await userEvent.click(screen.getByRole('button', { name: 'Add note' }));
    expect(await screen.findByText('The note could not be saved. Try again.')).toBeVisible();
    expect(screen.getByLabelText('New note')).toHaveValue('Hello');
  });
});
