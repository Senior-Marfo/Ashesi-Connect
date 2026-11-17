'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, type ApiClient, type PassMark, type PassMarkGrade } from '../lib/api';
import { Notice, SkeletonRows } from './app-shell';

type Api = Pick<ApiClient, 'passMarks' | 'setPassMark' | 'removePassMark'>;
type Load = { status: 'loading' | 'error' } | { status: 'ready'; marks: PassMark[] };

const COURSE_CODE = /^[A-Z]{2,5} \d{3}[A-Z]?$/;
const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
const normalise = (code: string) => code.trim().toUpperCase().replace(/^([A-Z]{2,5})\s*(\d)/, '$1 $2');

/** Per-course minimum passing grades. Every course not listed passes at D+. */
export function PassMarks({ api }: { api: Api }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [courseCode, setCourseCode] = useState('');
  const [grade, setGrade] = useState<PassMarkGrade>('C');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  async function refresh() {
    try {
      const { passMarks } = await api.passMarks();
      setLoad({ status: 'ready', marks: passMarks });
    } catch {
      setLoad({ status: 'error' });
    }
  }
  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const code = normalise(courseCode);
  const validCode = COURSE_CODE.test(code);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!validCode) return;
    const existing = load.status === 'ready' ? load.marks.find(mark => mark.courseCode === code) : undefined;
    const change = existing ? `Change ${code} from ${existing.minimumGrade} to ${grade}?` : `Set the pass mark for ${code} to ${grade}?`;
    if (!window.confirm(`${change} Every student's audit, the register and reports use it straight away.`)) return;
    setBusy(true);
    try {
      await api.setPassMark(code, grade, note.trim() || undefined);
      setNotice({ tone: 'info', text: `${code} now passes at ${grade} or above.` });
      setCourseCode('');
      setNote('');
      await refresh();
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof ApiError && cause.message !== cause.code ? cause.message : 'The pass mark could not be saved.' });
    } finally {
      setBusy(false);
    }
  }

  async function remove(mark: PassMark) {
    if (!window.confirm(`Remove the ${mark.minimumGrade} pass mark for ${mark.courseCode}? It will pass at the default D+.`)) return;
    try {
      await api.removePassMark(mark.courseCode);
      setNotice({ tone: 'info', text: `${mark.courseCode} passes at the default D+ again.` });
      await refresh();
    } catch {
      setNotice({ tone: 'error', text: 'The pass mark could not be removed.' });
    }
  }

  return (
    <>
      <form className="pass-mark-form" onSubmit={event => void save(event)}>
        <div className="field">
          <label htmlFor="pass-course">Course code</label>
          <input id="pass-course" className="input mono" required value={courseCode} onChange={event => setCourseCode(event.target.value)} placeholder="MATH 141" aria-describedby="pass-course-hint" aria-invalid={courseCode !== '' && !validCode} />
          <small id="pass-course-hint">{courseCode && !validCode ? 'Course codes look like “MATH 141”.' : 'Courses not listed pass at D+.'}</small>
        </div>
        <fieldset className="radios">
          <legend>Pass mark</legend>
          {(['C', 'D+'] as const).map(option => (
            <label key={option}><input type="radio" name="pass-grade" value={option} checked={grade === option} onChange={() => setGrade(option)} /> {option}</label>
          ))}
        </fieldset>
        <div className="field wide">
          <label htmlFor="pass-note">Source <span className="muted">(optional)</span></label>
          <input id="pass-note" className="input" maxLength={500} value={note} onChange={event => setNote(event.target.value)} placeholder="e.g. Registry memo of 12 March 2027" />
        </div>
        <button className="button" type="submit" disabled={busy || !validCode}>Save pass mark</button>
      </form>
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {load.status === 'loading' && <SkeletonRows rows={2} />}
      {load.status === 'error' && <Notice tone="error">Pass marks could not be loaded.</Notice>}
      {load.status === 'ready' && load.marks.length === 0 && <p className="empty">No course has a confirmed pass mark yet. Every course passes at D+.</p>}
      {load.status === 'ready' && load.marks.length > 0 && (
        <div className="table-wrap">
          <table className="courses">
            <caption className="visually-hidden">Course pass marks</caption>
            <thead><tr><th scope="col">Course</th><th scope="col">Pass mark</th><th scope="col" className="wide-only">Source</th><th scope="col" className="wide-only">Set by</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              {load.marks.map(mark => (
                <tr key={mark.courseCode}>
                  <td className="mono">{mark.courseCode}</td>
                  <td><strong>{mark.minimumGrade}</strong></td>
                  <td className="muted wide-only">{mark.note ?? '—'}</td>
                  <td className="nowrap wide-only"><span className="mono">{mark.updatedBy}</span> · {formatDate(mark.updatedAt)}</td>
                  <td><button type="button" className="link-button" onClick={() => void remove(mark)} aria-label={`Remove the pass mark for ${mark.courseCode}`}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
