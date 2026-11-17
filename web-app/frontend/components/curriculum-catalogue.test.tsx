import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CurriculumCatalogue } from './curriculum-catalogue';

describe('CurriculumCatalogue', () => {
  it('lists curricula with status and validation issues', () => {
    render(<CurriculumCatalogue load={{ status: 'ready', curricula: [
      { programme: 'CS', track: 'standard', version: '2028-v1', status: 'DRAFT', validationIssues: ['TOTAL_CREDIT_MISMATCH'] },
      { programme: 'BA', track: 'pre-calculus', version: '2028-v1', status: 'REVIEWED', validationIssues: [] }
    ] }} />);
    expect(within(screen.getByRole('row', { name: /CS/ })).getByText('Total credit mismatch')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /BA/ })).getByText('Reviewed')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /BA/ })).getByText('No issues')).toBeInTheDocument();
  });

  it('has empty and error states', () => {
    const { rerender } = render(<CurriculumCatalogue load={{ status: 'ready', curricula: [] }} />);
    expect(screen.getByText('No curricula have been imported yet.')).toBeInTheDocument();
    rerender(<CurriculumCatalogue load={{ status: 'error' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded');
  });
});
