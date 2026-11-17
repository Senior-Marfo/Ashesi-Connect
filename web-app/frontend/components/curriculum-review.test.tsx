import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type StoredCurriculum } from '../lib/api';
import { CurriculumReview } from './curriculum-review';

const key = { programme: 'CS', track: 'standard', version: '2028-v1' };
const draft: StoredCurriculum = {
  ...key, status: 'DRAFT', validationIssues: [], sourceWorkbookHash: '6c88df76001f5589',
  sources: [{ sourceUrl: 'https://registry.example.edu/a.xlsx', sourceKind: 'REGISTRY_PROVIDED_WORKBOOK', retrievedAt: '2026-11-17T00:00:00Z', effectiveYear: 2028, contentHash: 'x' }],
  rules: {
    totalCredits: 4,
    requiredCourses: [
      { courseCode: 'CS 111', credits: 1, minimumGrade: 'D+', category: 'Computing' },
      { courseCode: 'MATH 141', credits: 1, minimumGrade: 'C', category: 'Mathematics' }
    ],
    electivePools: [{ category: 'Non-Major Electives', creditsRequired: 2, courseCodes: ['AS 101', 'ECON 210'], africanStudiesMinimum: 1, africanStudiesCodes: ['AS 101'] }]
  }
};

function fakeApi(curriculum = draft) {
  let current = curriculum;
  return {
    curriculumDetail: vi.fn(async () => ({ curriculum: current })),
    reviewCurriculum: vi.fn(async (_key: typeof key, evidenceReference: string) => {
      current = { ...current, status: 'REVIEWED', review: { reviewerId: 'u1', reviewerIdentifier: 'STF-0001', reviewedAt: '2026-11-18T00:00:00Z', evidenceReference } };
      return { curriculum: current };
    })
  };
}
afterEach(() => vi.restoreAllMocks());

describe('CurriculumReview', () => {
  it('shows the full requirements, with C pass marks and African Studies options', async () => {
    render(<CurriculumReview api={fakeApi()} curriculumKey={key} access={{ enabled: true, allowed: true }} onReviewed={vi.fn()} />);
    expect(await screen.findByRole('row', { name: /MATH 141/ })).toHaveTextContent('C');
    expect(screen.getByText(/AS 101 \(African Studies\) · ECON 210/)).toBeVisible();
    expect(screen.getByText(/at least 1 African Studies/)).toBeVisible();
  });

  it('needs evidence and a confirmation before marking a draft reviewed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const api = fakeApi();
    const onReviewed = vi.fn();
    render(<CurriculumReview api={api} curriculumKey={key} access={{ enabled: true, allowed: true }} onReviewed={onReviewed} />);
    const button = await screen.findByRole('button', { name: 'Mark as reviewed' });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Evidence of Registry approval'), 'Registry memo 14');
    expect(button).toBeDisabled();
    await userEvent.click(screen.getByLabelText(/I have checked these requirements/));
    await userEvent.click(button);
    expect(api.reviewCurriculum).toHaveBeenCalledWith(key, 'Registry memo 14');
    expect(onReviewed).toHaveBeenCalled();
    expect(await screen.findByText(/Reviewed by/)).toHaveTextContent('STF-0001');
    expect(screen.queryByRole('button', { name: 'Mark as reviewed' })).toBeNull();
  });

  it('explains why a draft cannot be reviewed', async () => {
    const { rerender } = render(<CurriculumReview api={fakeApi()} curriculumKey={key} access={{ enabled: false, allowed: false }} onReviewed={vi.fn()} />);
    expect(await screen.findByText(/Review is switched off/)).toBeVisible();
    rerender(<CurriculumReview api={fakeApi()} curriculumKey={key} access={{ enabled: true, allowed: false }} onReviewed={vi.fn()} />);
    expect(await screen.findByText(/not on the reviewer list/)).toBeVisible();
    render(<CurriculumReview api={fakeApi({ ...draft, validationIssues: ['EMPTY_ELECTIVE_OPTIONS'] })} curriculumKey={key} access={{ enabled: true, allowed: true }} onReviewed={vi.fn()} />);
    expect(await screen.findByText(/Validation issues: Empty elective options/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Mark as reviewed' })).toBeNull();
  });

  it('reports a review the server refuses', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const api = { ...fakeApi(), reviewCurriculum: vi.fn().mockRejectedValue(new ApiError(409, 'CURRICULUM_REVIEW_CONFLICT')) };
    render(<CurriculumReview api={api} curriculumKey={key} access={{ enabled: true, allowed: true }} onReviewed={vi.fn()} />);
    await userEvent.type(await screen.findByLabelText('Evidence of Registry approval'), 'Memo');
    await userEvent.click(screen.getByLabelText(/I have checked these requirements/));
    await userEvent.click(screen.getByRole('button', { name: 'Mark as reviewed' }));
    expect(await screen.findByText(/Someone else reviewed this version first/)).toBeVisible();
  });
});
