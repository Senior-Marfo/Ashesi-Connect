'use client';
import type { ReactNode } from 'react';
import { AppShell, FullPageLoading, Notice, STUDENT_NAV, SkeletonRows } from '../components/app-shell';
import type { Eligibility } from './api';
import { useRequireRole, useSession } from './session';
import { useLoad } from './use-load';

/** Shared frame for the student screens that read the eligibility assessment. */
export function StudentEligibilityPage({ title, eyebrow, children }: { title: string; eyebrow: string; children: (eligibility: Eligibility) => ReactNode }) {
  const session = useRequireRole('STUDENT');
  const { api } = useSession();
  const load = useLoad(() => api.myEligibility(), Boolean(session), 'me');
  if (!session) return <FullPageLoading />;
  return (
    <AppShell eyebrow={eyebrow} title={title} nav={STUDENT_NAV}>
      {load.status === 'loading' && <SkeletonRows rows={6} />}
      {load.status === 'error' && <Notice tone="error">Your graduation status could not be loaded. Refresh the page, and contact the Registry if this continues.</Notice>}
      {load.status === 'ready' && children(load.data)}
    </AppShell>
  );
}

export const passMarksOf = (eligibility: Eligibility) =>
  Object.fromEntries(eligibility.requirements.flatMap(group => group.items.map(item => [item.code, item.minimumGrade])));
