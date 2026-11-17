import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AcademicPreview } from '../lib/api';
import { AcademicPreviewPanel } from './academic-preview';

const base: AcademicPreview = {
  status: 'INSUFFICIENT_DATA', officialCertification: false, programme: 'CS', track: 'standard', yearGroup: 2028,
  curriculumVersion: null, issues: [], audit: null
};

describe('AcademicPreviewPanel', () => {
  it('always labels the preview as provisional and not a certification', () => {
    render(<AcademicPreviewPanel load={{ status: 'loading' }} />);
    expect(screen.getByText('Provisional')).toBeInTheDocument();
    expect(screen.getByText(/not an official degree audit/)).toBeInTheDocument();
  });

  it('explains missing data in plain language without duplicates', () => {
    render(<AcademicPreviewPanel load={{ status: 'ready', preview: { ...base, issues: ['CURRICULUM_UNAVAILABLE', 'NO_APPLICABLE_CURRICULUM', 'CURRICULUM_UNAVAILABLE', 'SOMETHING_NEW'] } }} />);
    expect(screen.getByText('Not enough verified information yet')).toBeInTheDocument();
    expect(screen.getAllByText('Your programme’s curriculum has not been reviewed yet.')).toHaveLength(1);
    expect(screen.getByText('Something new')).toBeInTheDocument();
  });

  it('shows counted credits and each remaining requirement with its reason', () => {
    const preview: AcademicPreview = {
      ...base, status: 'REQUIREMENTS_OUTSTANDING', curriculumVersion: '2028-v1', exploratoryGpa: { gpa: 3.42, issues: [] },
      audit: { creditsEarned: 20, creditsRequired: 34.5, creditsInProgress: 2, percentComplete: 58, remainingRequirements: [
        { code: 'CS 415', category: 'Major', credits: 1, reason: 'FAILED' },
        { code: 'AFRICAN_STUDIES', category: 'Electives', credits: 0, reason: 'AFRICAN_STUDIES_MISSING' }
      ] }
    };
    render(<AcademicPreviewPanel load={{ status: 'ready', preview }} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '58');
    expect(screen.getByText('20 of 34.5 credits counted (58%), 2 in progress.')).toBeInTheDocument();
    expect(screen.getByText('Below the pass mark — retake needed')).toBeInTheDocument();
    expect(screen.getByText('African Studies course needed')).toBeInTheDocument();
    expect(screen.getByText('3.42')).toBeInTheDocument();
  });

  it('has an unavailable state that does not hide the course record', () => {
    render(<AcademicPreviewPanel load={{ status: 'unavailable' }} />);
    expect(screen.getByText(/preview is unavailable right now/)).toBeInTheDocument();
  });
});
