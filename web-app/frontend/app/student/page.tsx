'use client';
import { useEffect, useState } from 'react';
import { AppShell, FullPageLoading, Notice, SkeletonRows } from '../../components/app-shell';
import { AcademicPreviewPanel, type PreviewLoad } from '../../components/academic-preview';
import { StudentProfile } from '../../components/student-record';
import type { StudentRecord } from '../../lib/api';
import { useRequireRole, useSession } from '../../lib/session';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; record: StudentRecord };

export default function StudentHomePage() {
  const session = useRequireRole('STUDENT');
  const { api } = useSession();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [preview, setPreview] = useState<PreviewLoad>({ status: 'loading' });

  useEffect(() => {
    if (!session) return;
    let active = true;
    api.myRecord()
      .then(record => { if (active) setLoad({ status: 'ready', record }); })
      .catch(() => { if (active) setLoad({ status: 'error' }); });
    api.academicPreview()
      .then(result => { if (active) setPreview({ status: 'ready', preview: result }); })
      .catch(() => { if (active) setPreview({ status: 'unavailable' }); });
    return () => { active = false; };
  }, [api, session]);

  if (!session) return <FullPageLoading />;

  const firstName = load.status === 'ready' ? load.record.student.fullName.split(' ')[0] : undefined;
  return (
    <AppShell eyebrow="My academic record" title={firstName ? `Hello, ${firstName}` : 'Your record'}>
      {load.status === 'loading' && <SkeletonRows rows={6} />}
      {load.status === 'error' && <Notice tone="error">Your record could not be loaded. Refresh the page, and contact the Registry if this continues.</Notice>}
      {load.status === 'ready' && (
        <StudentProfile record={load.record}>
          <AcademicPreviewPanel load={preview} />
        </StudentProfile>
      )}
    </AppShell>
  );
}
