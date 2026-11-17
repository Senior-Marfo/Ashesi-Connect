import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CourseTable, creditTotals } from './student-record';

const courses = [
  { courseCode: 'MATH 141', attempts: [{ credits: 1, grade: 'D', status: 'COMPLETED' as const, semester: '2024 Fall' }, { credits: 1, grade: 'B', status: 'COMPLETED' as const, semester: '2025 Spring' }] },
  { courseCode: 'CS 415', attempts: [{ credits: 1, status: 'ENROLLED' as const, semester: '2026 Fall' }] },
  { courseCode: 'SOAN 211', attempts: [{ credits: 0.5, grade: 'A', status: 'COMPLETED' as const }] }
];

describe('student record', () => {
  it('counts only the latest attempt of each course', () => {
    expect(creditTotals(courses)).toEqual({ graded: 1.5, inProgress: 1 });
  });

  it('shows the latest grade with earlier attempts kept visible', () => {
    render(<CourseTable courses={courses} />);
    const row = screen.getByRole('row', { name: /MATH 141/ });
    expect(within(row).getByText('B')).toBeInTheDocument();
    expect(within(row).getByText('Earlier: D (2024 Fall)')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /CS 415/ })).getByText('In progress')).toBeInTheDocument();
  });

  it('has a designed empty state', () => {
    render(<CourseTable courses={[]} />);
    expect(screen.getByText('No courses are on record yet.')).toBeInTheDocument();
  });
});
