import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PassMark } from '../lib/api';
import { PassMarks } from './pass-marks';

const mark: PassMark = { courseCode: 'CS 400', minimumGrade: 'C', note: 'Registry memo 14', updatedBy: 'STF-1001', updatedAt: '2026-11-17T08:00:00Z' };

function fakeApi(marks: PassMark[] = [mark]) {
  let current = [...marks];
  return {
    passMarks: vi.fn(async () => ({ defaultMinimumGrade: 'D+', passMarks: current })),
    setPassMark: vi.fn(async (courseCode: string, minimumGrade: 'C' | 'D+', note?: string) => {
      current = [...current.filter(m => m.courseCode !== courseCode), { courseCode, minimumGrade, note, updatedBy: 'STF-1001', updatedAt: '2026-11-17T09:00:00Z' }];
      return { courseCode, minimumGrade };
    }),
    removePassMark: vi.fn(async (courseCode: string) => { current = current.filter(m => m.courseCode !== courseCode); })
  };
}

afterEach(() => vi.restoreAllMocks());

describe('PassMarks', () => {
  it('lists confirmed pass marks with their source and author', async () => {
    render(<PassMarks api={fakeApi()} />);
    const row = await screen.findByRole('row', { name: /CS 400/ });
    expect(row).toHaveTextContent('C');
    expect(row).toHaveTextContent('Registry memo 14');
    expect(row).toHaveTextContent('STF-1001');
  });

  it('normalises the course code, confirms, saves and refreshes', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const api = fakeApi([]);
    render(<PassMarks api={api} />);
    expect(await screen.findByText(/Every course passes at D\+/)).toBeVisible();
    await userEvent.type(screen.getByLabelText('Course code'), 'math141');
    await userEvent.type(screen.getByLabelText(/Source/), 'Memo 3');
    await userEvent.click(screen.getByRole('button', { name: 'Save pass mark' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Set the pass mark for MATH 141 to C?'));
    expect(api.setPassMark).toHaveBeenCalledWith('MATH 141', 'C', 'Memo 3');
    expect(await screen.findByText('MATH 141 now passes at C or above.')).toBeVisible();
    expect(screen.getByRole('row', { name: /MATH 141/ })).toBeVisible();
    expect(screen.getByLabelText('Course code')).toHaveValue('');
  });

  it('blocks malformed codes and does nothing when the admin cancels', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const api = fakeApi();
    render(<PassMarks api={api} />);
    await screen.findByRole('row', { name: /CS 400/ });
    await userEvent.type(screen.getByLabelText('Course code'), 'MATH');
    expect(screen.getByText('Course codes look like “MATH 141”.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save pass mark' })).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Course code'));
    await userEvent.type(screen.getByLabelText('Course code'), 'CS 400');
    await userEvent.click(screen.getByLabelText('D+'));
    await userEvent.click(screen.getByRole('button', { name: 'Save pass mark' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Change CS 400 from C to D+?'));
    expect(api.setPassMark).not.toHaveBeenCalled();
  });

  it('removes a pass mark after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const api = fakeApi();
    render(<PassMarks api={api} />);
    const row = await screen.findByRole('row', { name: /CS 400/ });
    await userEvent.click(within(row).getByRole('button', { name: 'Remove the pass mark for CS 400' }));
    expect(api.removePassMark).toHaveBeenCalledWith('CS 400');
    expect(await screen.findByText('CS 400 passes at the default D+ again.')).toBeVisible();
    expect(screen.queryByRole('row', { name: /CS 400/ })).toBeNull();
  });
});
