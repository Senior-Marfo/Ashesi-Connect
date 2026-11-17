import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Eligibility } from '../lib/api';
import { RemainingPlan, RequirementTree } from './requirements';
import { StandingBadge, StatusCard } from './standing';

const eligibility: Eligibility = {
  student: { studentId: '92800001', fullName: 'Ama Mensah', programme: 'CS', yearGroup: 2028, track: 'standard', synthetic: true },
  officialCertification: false,
  status: 'REQUIREMENTS_REMAINING',
  curriculum: { basis: 'SYNTHETIC', version: 'SYNTHETIC-1' },
  expectedGraduation: '2028 Spring',
  audit: {
    creditsEarned: 20, creditsRequired: 34.5, creditsInProgress: 4, percentComplete: 57.97,
    remainingRequirements: [
      { code: 'CS 321', category: 'Major', credits: 1, reason: 'IN_PROGRESS' },
      { code: 'CS 400', category: 'Capstone', credits: 1, reason: 'NOT_TAKEN' },
      { code: 'MATH 141', category: 'Mathematics & Quantitative', credits: 1, reason: 'FAILED' },
      { code: 'Major Electives', category: 'Major Electives', credits: 4, reason: 'ELECTIVE_SLOT_OPEN' }
    ]
  },
  standing: { level: 'YELLOW', reasons: ['FAILED_COURSE_TO_RETAKE'], creditsOutstanding: 10.5, termsRemaining: 3, creditsPerTermNeeded: 3.5 },
  requirements: [
    { category: 'Major', kind: 'REQUIRED', creditsRequired: 2, creditsCompleted: 1, creditsInProgress: 1, options: [], items: [
      { code: 'CS 212', credits: 1, minimumGrade: 'D+', state: 'COMPLETED', grade: 'A', attempts: 1 },
      { code: 'CS 321', credits: 1, minimumGrade: 'D+', state: 'IN_PROGRESS', attempts: 1 }
    ] },
    { category: 'Major Electives', kind: 'ELECTIVE', creditsRequired: 4, creditsCompleted: 0, creditsInProgress: 0, options: ['CS 351', 'CS 352'], items: [] }
  ],
  nextActions: [{ kind: 'RETAKE', code: 'MATH 141', category: 'Mathematics & Quantitative', credits: 1 }],
  issues: []
};

describe('graduation status', () => {
  it('pairs every standing colour with an icon and words', () => {
    const { container, rerender } = render(<StandingBadge level="RED" />);
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
    rerender(<StandingBadge level="GREEN" met />);
    expect(screen.getByText('Requirements met')).toBeInTheDocument();
  });

  it('summarises status, standing reasons, progress and next steps, and labels synthetic rules', () => {
    render(<StatusCard eligibility={eligibility} />);
    expect(screen.getByText('Not yet eligible')).toBeInTheDocument();
    expect(screen.getByText('At risk')).toBeInTheDocument();
    expect(screen.getByText(/below its pass mark and needs a retake/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '20 of 34.5 credits completed, 4 in progress' })).toBeInTheDocument();
    expect(screen.getByText('Retake')).toBeInTheDocument();
    expect(screen.getByText('MATH 141')).toBeInTheDocument();
    expect(screen.getByText(/illustrative synthetic programme rules/)).toBeInTheDocument();
  });

  it('explains why status is unavailable when no curriculum applies', () => {
    render(<StatusCard eligibility={{ ...eligibility, status: 'NO_CURRICULUM', audit: null, standing: null, requirements: [], nextActions: [], curriculum: null, issues: ['CURRICULUM_UNAVAILABLE'] }} />);
    expect(screen.getByText('Not available yet')).toBeInTheDocument();
    expect(screen.getByText(/not been reviewed by the Registry/)).toBeInTheDocument();
  });
});

describe('requirement tree', () => {
  it('filters by state and searches by course code', async () => {
    render(<RequirementTree groups={eligibility.requirements} />);
    expect(screen.getByText('CS 212')).toBeInTheDocument();
    expect(screen.getByText('4 credits still to choose')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /In progress/ }));
    expect(screen.queryByText('CS 212')).not.toBeInTheDocument();
    expect(screen.getByText('CS 321')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^All/ }));
    await userEvent.type(screen.getByLabelText('Find a course'), '212');
    expect(screen.getByText('CS 212')).toBeInTheDocument();
    expect(screen.queryByText('CS 321')).not.toBeInTheDocument();
  });
});

describe('remaining plan', () => {
  it('puts retakes first and spreads the rest over the coming terms at a normal load', () => {
    render(<RemainingPlan eligibility={eligibility} today={new Date('2026-11-17T12:00:00')} normalLoad={2} />);
    const terms = screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent);
    expect(terms).toEqual(['This term in progress', '2027 Spring', '2027 Fall']);
    const spring = screen.getByRole('heading', { name: '2027 Spring' }).parentElement!;
    expect(within(spring).getByText('MATH 141')).toBeInTheDocument();
    expect(within(spring).getByText('CS 400')).toBeInTheDocument();
    expect(within(screen.getByRole('heading', { name: '2027 Fall' }).parentElement!).getByText('Major Electives: 4 credits')).toBeInTheDocument();
  });

  it('flags terms that fall after the expected graduation', () => {
    render(<RemainingPlan eligibility={{ ...eligibility, expectedGraduation: '2027 Spring' }} today={new Date('2026-11-17T12:00:00')} normalLoad={2} />);
    expect(screen.getByText('After expected graduation')).toBeInTheDocument();
  });
});
