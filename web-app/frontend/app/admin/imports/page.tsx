'use client';
import { useState, type ChangeEvent } from 'react';
import { ADMIN_NAV, AppShell, FullPageLoading, Notice, SkeletonRows } from '../../../components/app-shell';
import { ApiError, type ImportKind, type ImportPreview, type ImportUpload } from '../../../lib/api';
import { saveBlob } from '../../../lib/download';
import { useRequireRole, useSession } from '../../../lib/session';
import { useLoad } from '../../../lib/use-load';

const TEMPLATES: Record<ImportKind, { label: string; columns: string; example: string; help: string }> = {
  STUDENTS: {
    label: 'Students',
    columns: 'studentId,fullName,programme,yearGroup,track',
    example: '20290001,Ama Mensah,CS,2029,standard',
    help: 'One row per student. Track is standard, pre-calculus or calculus-1-2 (standard if left empty). Existing students are updated; new ones get an account that needs a temporary password from student lookup.'
  },
  COURSES: {
    label: 'Course records',
    columns: 'studentId,courseCode,credits,grade,status,semester',
    example: '20290001,MATH 141,1,D,,2025 Fall\n20290001,MATH 141,1,B,,2026 Spring\n20290001,CS 212,1,,enrolled,2026 Fall',
    help: 'One row per attempt, oldest first; repeat a course for retakes. Leave the grade empty for enrolled or incomplete courses. Each course in the file replaces that student’s record for the course. Students must already exist.'
  }
};
const MAX_BYTES = 4_000_000;

export default function ImportsPage() {
  const session = useRequireRole('ADMIN');
  const { api } = useSession();
  const [kind, setKind] = useState<ImportKind>('STUDENTS');
  const [upload, setUpload] = useState<ImportUpload | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const history = useLoad(() => api.importHistory(), Boolean(session), `history-${historyVersion}`);
  if (!session) return <FullPageLoading />;

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreview(null);
    setNotice(null);
    setUpload(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { setNotice({ tone: 'error', text: 'Choose a .csv file. In Excel, use File → Save As → CSV UTF-8.' }); return; }
    if (file.size > MAX_BYTES) { setNotice({ tone: 'error', text: 'The file is larger than 4 MB. Split it into smaller files.' }); return; }
    const next = { kind, filename: file.name, content: await file.text() };
    setUpload(next);
    setBusy(true);
    try {
      setPreview(await api.previewImport(next));
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof ApiError && cause.message !== cause.code ? cause.message : 'The file could not be checked.' });
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!upload || !preview || preview.errorCount > 0) return;
    if (!window.confirm(`Apply ${upload.filename}: ${preview.created} new and ${preview.updated} updated ${kind === 'STUDENTS' ? 'students' : 'course records'}?`)) return;
    setBusy(true);
    try {
      const { batch } = await api.applyImport(upload);
      setNotice({ tone: 'info', text: `Imported ${batch.filename}: ${batch.created} new, ${batch.updated} updated. You can undo it below until another import is applied.` });
      setUpload(null);
      setPreview(null);
      setHistoryVersion(current => current + 1);
    } catch {
      setNotice({ tone: 'error', text: 'The import was not applied. Check the file again.' });
    } finally {
      setBusy(false);
    }
  }

  async function undo(batchId: string, filename: string) {
    if (!window.confirm(`Undo ${filename}? Every change it made is reversed.`)) return;
    try {
      await api.undoImport(batchId);
      setNotice({ tone: 'info', text: `Undid ${filename}.` });
    } catch {
      setNotice({ tone: 'error', text: 'That import could not be undone. Undo newer imports first.' });
    }
    setHistoryVersion(current => current + 1);
  }

  const template = TEMPLATES[kind];
  return (
    <AppShell eyebrow="Registry workspace" title="Imports" nav={ADMIN_NAV}>
      <div className="messages-layout">
        <section aria-labelledby="new-import" className="form">
          <h2 id="new-import" className="section-title">New import</h2>
          <label className="field">What are you importing?
            <select className="input" value={kind} onChange={event => { setKind(event.target.value as ImportKind); setUpload(null); setPreview(null); }}>
              <option value="STUDENTS">Students</option>
              <option value="COURSES">Course records</option>
            </select>
          </label>
          <p className="caption">{template.help}</p>
          <button type="button" className="button ghost" onClick={() => saveBlob(new Blob([`${template.columns}\r\n${template.example.replaceAll('\n', '\r\n')}\r\n`], { type: 'text/csv' }), `${kind.toLowerCase()}-template.csv`)}>
            Download {template.label.toLowerCase()} template
          </button>
          <label className="field">CSV file
            <input key={kind} className="input" type="file" accept=".csv,text/csv" onChange={event => void choose(event)} />
          </label>
          {busy && <SkeletonRows rows={2} />}
          {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
          {preview && (
            <div className="import-preview" aria-live="polite">
              <dl className="figures register-counts">
                <div><dt>Valid rows</dt><dd>{preview.rows}</dd></div>
                <div><dt>New</dt><dd>{preview.created}</dd></div>
                <div><dt>Updated</dt><dd>{preview.updated}</dd></div>
                <div><dt>Problems</dt><dd className={preview.errorCount ? 'count-red' : undefined}>{preview.errorCount}</dd></div>
              </dl>
              {preview.errorCount > 0 ? (
                <>
                  <Notice tone="error">Fix these problems and choose the file again. Nothing has been imported.</Notice>
                  <div className="table-wrap">
                    <table className="courses">
                      <thead><tr><th scope="col">Row</th><th scope="col">Column</th><th scope="col">Problem</th></tr></thead>
                      <tbody>{preview.errors.map((error, index) => <tr key={index}><td>{error.row || '—'}</td><td className="mono">{error.column ?? '—'}</td><td>{error.message}</td></tr>)}</tbody>
                    </table>
                  </div>
                  {preview.errorCount > preview.errors.length && <p className="caption">Showing the first {preview.errors.length} of {preview.errorCount} problems.</p>}
                </>
              ) : (
                <button type="button" className="button" disabled={busy} onClick={() => void apply()}>Apply import</button>
              )}
            </div>
          )}
        </section>

        <section aria-labelledby="history-heading">
          <h2 id="history-heading" className="section-title">History</h2>
          {history.status === 'loading' && <SkeletonRows rows={3} />}
          {history.status === 'error' && <Notice tone="error">Import history could not be loaded.</Notice>}
          {history.status === 'ready' && history.data.batches.length === 0 && <p className="empty">No imports yet.</p>}
          {history.status === 'ready' && history.data.batches.length > 0 && (
            <ul className="sent-list">
              {history.data.batches.map(batch => (
                <li key={batch.id}>
                  <div className="sent-head">
                    <strong className="mono">{batch.filename}</strong>
                    <span className="tag">{batch.kind === 'STUDENTS' ? 'Students' : 'Courses'}</span>
                    {batch.status === 'ROLLED_BACK' && <span className="tag">Undone</span>}
                  </div>
                  <p className="muted">{new Date(batch.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · {batch.created} new · {batch.updated} updated</p>
                  {batch.canUndo && <button type="button" className="button ghost" onClick={() => void undo(batch.id, batch.filename)}>Undo this import</button>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
