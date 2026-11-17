'use client';
import { useState } from 'react';
import { ADMIN_NAV, AppShell, FullPageLoading } from '../../../components/app-shell';
import { CurriculumCatalogue, type CatalogueLoad } from '../../../components/curriculum-catalogue';
import { CurriculumReview } from '../../../components/curriculum-review';
import type { CurriculumKey } from '../../../lib/api';
import { useRequireRole, useSession } from '../../../lib/session';
import { useLoad } from '../../../lib/use-load';

export default function CurriculumPage() {
  const session = useRequireRole('ADMIN');
  const { api } = useSession();
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<CurriculumKey>();
  const catalogue = useLoad(() => api.curricula(), Boolean(session), `catalogue-${version}`);
  const access = useLoad(() => api.curriculumReviewAccess(), Boolean(session), 'review-access');
  if (!session) return <FullPageLoading />;
  const load: CatalogueLoad = catalogue.status === 'ready' ? { status: 'ready', curricula: catalogue.data.curricula } : { status: catalogue.status };
  return (
    <AppShell eyebrow="Registry workspace" title="Curriculum" nav={ADMIN_NAV}>
      <CurriculumCatalogue load={load} selected={selected} onSelect={setSelected} />
      {selected && (
        <CurriculumReview
          api={api}
          curriculumKey={selected}
          access={access.status === 'ready' ? access.data : null}
          onReviewed={() => setVersion(current => current + 1)}
        />
      )}
    </AppShell>
  );
}
