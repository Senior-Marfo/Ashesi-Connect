import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type CourseRecord, type StudentSummary } from '../lib/api';
import { RecordEditor, StudentDetailsForm } from './record-editor';

const student: StudentSummary = { studentId: '20310001', fullName: 'Yaa Asantewaa', programme: 'MIS', yearGroup: 2031, track: 'standard' };
const courses: CourseRecord[] = [{ courseCode: 'MATH 141', attempts: [{ credits: 1, status: 'COMPLETED', grade: 'E', semester: '2024 Fall' }] }];

function fakeApi() {
  return {
    updateStudent: vi.fn(async () => ({ student, changed: ['track'] })),
    saveCourseRecord: vi.fn(async (_id: string, courseCode: string, attempts: CourseRecord['attempts']) => ({ course: { courseCode: courseCode.toUpperCase(), attempts } })),
    removeCourseRecord: vi.fn(async () => undefined)
  };
}
afterEach(() => vi.restoreAllMocks());

describe('RecordEditor', () => {
  it('is read-only for synthetic records', () => {
    render(<RecordEditor api={fakeApi()} student={{ ...student, synthetic: true }} courses={courses} onSaved={vi.fn()} />);
    expect(screen.getByText(/cannot be edited here/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Save details' })).toBeNull();
  });

  it('saves changed details and reports what changed', async () => {
    const api = fakeApi();
    const onSaved = vi.fn();
    render(<RecordEditor api={api} student={student} courses={courses} onSaved={onSaved} />);
    await userEvent.selectOptions(screen.getByLabelText('Maths track'), 'pre-calculus');
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(api.updateStudent).toHaveBeenCalledWith('20310001', { fullName: 'Yaa Asantewaa', programme: 'MIS', yearGroup: 2031, track: 'pre-calculus' });
    expect(await screen.findByText('Saved: track.')).toBeVisible();
    expect(onSaved).toHaveBeenCalled();
  });

  it('adds a retake to an existing course, keeping the earlier attempt', async () => {
    const api = fakeApi();
    render(<RecordEditor api={api} student={student} courses={courses} onSaved={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText('Course'), 'MATH 141');
    await userEvent.click(screen.getByRole('button', { name: 'Add a retake' }));
    const retake = screen.getByRole('group', { name: 'Attempt 2' });
    await userEvent.selectOptions(within(retake).getByLabelText('Grade'), 'B');
    await userEvent.type(within(retake).getByLabelText('Term'), '2025 Spring');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(api.saveCourseRecord).toHaveBeenCalledWith('20310001', 'MATH 141', [
      { credits: 1, status: 'COMPLETED', grade: 'E', semester: '2024 Fall' },
      { credits: 1, status: 'COMPLETED', grade: 'B', semester: '2025 Spring' }
    ]);
    expect(await screen.findByText('Saved MATH 141 with 2 attempts.')).toBeVisible();
  });

  it('records a new in-progress course without a grade, and removes a course after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const api = fakeApi();
    render(<RecordEditor api={api} student={student} courses={courses} onSaved={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Course code'), 'CS 212');
    const attempt = screen.getByRole('group', { name: 'Attempt 1' });
    await userEvent.selectOptions(within(attempt).getByLabelText('Status'), 'ENROLLED');
    expect(within(attempt).getByLabelText('Grade')).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Add course' }));
    expect(api.saveCourseRecord).toHaveBeenCalledWith('20310001', 'CS 212', [{ credits: 1, status: 'ENROLLED' }]);

    await userEvent.selectOptions(screen.getByLabelText('Course'), 'MATH 141');
    await userEvent.click(screen.getByRole('button', { name: 'Remove course' }));
    expect(api.removeCourseRecord).toHaveBeenCalledWith('20310001', 'MATH 141');
  });

  it('shows the server reason when a save is refused', async () => {
    const api = { ...fakeApi(), saveCourseRecord: vi.fn().mockRejectedValue(new ApiError(400, 'INVALID_INPUT', 'Terms look like “2025 Fall”.')) };
    render(<RecordEditor api={api} student={student} courses={courses} onSaved={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Course code'), 'CS 212');
    await userEvent.selectOptions(within(screen.getByRole('group', { name: 'Attempt 1' })).getByLabelText('Grade'), 'A');
    await userEvent.click(screen.getByRole('button', { name: 'Add course' }));
    expect(await screen.findByText('Terms look like “2025 Fall”.')).toBeVisible();
  });
});

describe('StudentDetailsForm', () => {
  it('submits a new student with an ID and shows the result', async () => {
    const onSubmit = vi.fn(async () => 'Added 20310002.');
    render(<StudentDetailsForm withId submitLabel="Add student" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('New student ID'), ' 20310002 ');
    await userEvent.type(screen.getByLabelText('Full name'), 'Kojo Antwi');
    await userEvent.selectOptions(screen.getByLabelText('Programme'), 'EE');
    await userEvent.clear(screen.getByLabelText('Year group'));
    await userEvent.type(screen.getByLabelText('Year group'), '2030');
    await userEvent.click(screen.getByRole('button', { name: 'Add student' }));
    expect(onSubmit).toHaveBeenCalledWith({ studentId: '20310002', fullName: 'Kojo Antwi', programme: 'EE', yearGroup: 2030, track: 'standard' });
    expect(await screen.findByText('Added 20310002.')).toBeVisible();
  });
});
