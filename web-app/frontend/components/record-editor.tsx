'use client';
import { useState, type FormEvent } from 'react';
import { GRADE_SCALE, PROGRAMMES, TRACKS } from '../lib/academic';
import { ApiError, type ApiClient, type CourseAttempt, type CourseRecord, type StudentDetails, type StudentSummary } from '../lib/api';
import { Notice } from './app-shell';

type Feedback = { tone: 'info' | 'error'; text: string } | null;
const reason = (cause: unknown, fallback: string) => (cause instanceof ApiError && cause.message && cause.message !== cause.code ? cause.message : fallback);

/** Student details for creating a record (with an ID) or editing one. */
export function StudentDetailsForm({ initial, submitLabel, onSubmit, withId = false }: {
  initial?: StudentDetails & { studentId?: string };
  submitLabel: string;
  withId?: boolean;
  onSubmit: (details: StudentDetails & { studentId: string }) => Promise<string>;
}) {
  const [studentId, setStudentId] = useState(initial?.studentId ?? '');
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [programme, setProgramme] = useState(initial?.programme ?? 'CS');
  const [yearGroup, setYearGroup] = useState(String(initial?.yearGroup ?? new Date().getFullYear() + 4));
  const [track, setTrack] = useState(initial?.track ?? 'standard');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const prefix = withId ? 'new' : 'edit';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      setFeedback({ tone: 'info', text: await onSubmit({ studentId: studentId.trim(), fullName: fullName.trim(), programme, yearGroup: Number(yearGroup), track }) });
    } catch (cause) {
      setFeedback({ tone: 'error', text: reason(cause, 'The record could not be saved.') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="record-form" onSubmit={event => void submit(event)}>
      {withId && (
        <div className="field">
          <label htmlFor={`${prefix}-id`}>New student ID</label>
          <input id={`${prefix}-id`} className="input mono" required inputMode="numeric" autoComplete="off" value={studentId} onChange={event => setStudentId(event.target.value)} placeholder="20310001" />
        </div>
      )}
      <div className="field span-2">
        <label htmlFor={`${prefix}-name`}>Full name</label>
        <input id={`${prefix}-name`} className="input" required maxLength={120} value={fullName} onChange={event => setFullName(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-programme`}>Programme</label>
        <select id={`${prefix}-programme`} className="input" value={programme} onChange={event => setProgramme(event.target.value)}>
          {PROGRAMMES.map(code => <option key={code} value={code}>{code}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-year`}>Year group</label>
        <input id={`${prefix}-year`} className="input" type="number" required min={2000} max={2100} value={yearGroup} onChange={event => setYearGroup(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-track`}>Maths track</label>
        <select id={`${prefix}-track`} className="input" value={track} onChange={event => setTrack(event.target.value)}>
          {TRACKS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div className="record-actions">
        <button className="button" type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
      </div>
      {feedback && <div className="span-all"><Notice tone={feedback.tone}>{feedback.text}</Notice></div>}
    </form>
  );
}

type DraftAttempt = { credits: string; status: CourseAttempt['status']; grade: string; semester: string };
const toDraft = (attempt: CourseAttempt): DraftAttempt => ({ credits: String(attempt.credits), status: attempt.status, grade: attempt.grade ?? '', semester: attempt.semester ?? '' });
const fromDraft = (draft: DraftAttempt): CourseAttempt => ({
  credits: Number(draft.credits),
  status: draft.status,
  ...(draft.status === 'COMPLETED' && draft.grade ? { grade: draft.grade } : {}),
  ...(draft.semester.trim() ? { semester: draft.semester.trim() } : {})
});
const BLANK: DraftAttempt = { credits: '1', status: 'COMPLETED', grade: '', semester: '' };
const NEW_COURSE = '__new__';

/** Adds, corrects or removes one course record, keeping every attempt (oldest first). */
export function CourseRecordEditor({ api, studentId, courses, onSaved }: {
  api: Pick<ApiClient, 'saveCourseRecord' | 'removeCourseRecord'>;
  studentId: string;
  courses: CourseRecord[];
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState(NEW_COURSE);
  const [courseCode, setCourseCode] = useState('');
  const [attempts, setAttempts] = useState<DraftAttempt[]>([BLANK]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const existing = courses.find(course => course.courseCode === selected);

  function choose(value: string) {
    setSelected(value);
    setFeedback(null);
    const course = courses.find(candidate => candidate.courseCode === value);
    setCourseCode(course?.courseCode ?? '');
    setAttempts(course ? course.attempts.map(toDraft) : [BLANK]);
  }
  const update = (index: number, changes: Partial<DraftAttempt>) =>
    setAttempts(current => current.map((attempt, position) => (position === index ? { ...attempt, ...changes, ...(changes.status && changes.status !== 'COMPLETED' ? { grade: '' } : {}) } : attempt)));

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const { course } = await api.saveCourseRecord(studentId, courseCode.trim(), attempts.map(fromDraft));
      setFeedback({ tone: 'info', text: `Saved ${course.courseCode} with ${course.attempts.length} attempt${course.attempts.length === 1 ? '' : 's'}.` });
      setSelected(course.courseCode);
      setCourseCode(course.courseCode);
      onSaved();
    } catch (cause) {
      setFeedback({ tone: 'error', text: reason(cause, 'The course record could not be saved.') });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing || !window.confirm(`Remove ${existing.courseCode} and all its attempts from ${studentId}'s record?`)) return;
    setBusy(true);
    try {
      await api.removeCourseRecord(studentId, existing.courseCode);
      setFeedback({ tone: 'info', text: `Removed ${existing.courseCode}.` });
      choose(NEW_COURSE);
      onSaved();
    } catch (cause) {
      setFeedback({ tone: 'error', text: reason(cause, 'The course record could not be removed.') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="course-editor" onSubmit={event => void save(event)}>
      <div className="record-form">
        <div className="field">
          <label htmlFor="course-choice">Course</label>
          <select id="course-choice" className="input" value={selected} onChange={event => choose(event.target.value)}>
            <option value={NEW_COURSE}>Add a course…</option>
            {courses.map(course => <option key={course.courseCode} value={course.courseCode}>{course.courseCode}</option>)}
          </select>
        </div>
        {!existing && (
          <div className="field">
            <label htmlFor="course-code">Course code</label>
            <input id="course-code" className="input mono" required value={courseCode} onChange={event => setCourseCode(event.target.value)} placeholder="MATH 141" />
          </div>
        )}
      </div>
      <fieldset className="attempts">
        <legend>Attempts, oldest first</legend>
        {attempts.map((attempt, index) => {
          const label = `Attempt ${index + 1}`;
          const id = `attempt-${index}`;
          return (
            <div className="attempt-row" key={index} role="group" aria-label={label}>
              <span className="attempt-number" aria-hidden="true">{index + 1}</span>
              <div className="field">
                <label htmlFor={`${id}-status`}>Status</label>
                <select id={`${id}-status`} className="input" value={attempt.status} onChange={event => update(index, { status: event.target.value as CourseAttempt['status'] })}>
                  <option value="COMPLETED">Graded</option>
                  <option value="ENROLLED">In progress</option>
                  <option value="INCOMPLETE">Incomplete</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${id}-grade`}>Grade</label>
                <select id={`${id}-grade`} className="input" value={attempt.grade} disabled={attempt.status !== 'COMPLETED'} required={attempt.status === 'COMPLETED'} onChange={event => update(index, { grade: event.target.value })}>
                  <option value="">—</option>
                  {GRADE_SCALE.map(grade => <option key={grade} value={grade}>{grade}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${id}-credits`}>Credits</label>
                <input id={`${id}-credits`} className="input" type="number" min={0.5} max={4} step={0.5} required value={attempt.credits} onChange={event => update(index, { credits: event.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`${id}-term`}>Term</label>
                <input id={`${id}-term`} className="input" value={attempt.semester} onChange={event => update(index, { semester: event.target.value })} placeholder="2025 Fall" />
              </div>
              <button type="button" className="link-button" disabled={attempts.length === 1} onClick={() => setAttempts(current => current.filter((_, position) => position !== index))} aria-label={`Remove ${label.toLowerCase()}`}>Remove</button>
            </div>
          );
        })}
        <button type="button" className="link-button" disabled={attempts.length >= 10} onClick={() => setAttempts(current => [...current, { ...BLANK, credits: current.at(-1)?.credits ?? '1' }])}>Add a retake</button>
      </fieldset>
      <div className="record-actions">
        <button className="button" type="submit" disabled={busy}>{existing ? 'Save changes' : 'Add course'}</button>
        {existing && <button type="button" className="button ghost" disabled={busy} onClick={() => void remove()}>Remove course</button>}
      </div>
      {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
    </form>
  );
}

/** The edit panel on an admin's student profile. Synthetic records are read-only. */
export function RecordEditor({ api, student, courses, onSaved }: {
  api: Pick<ApiClient, 'updateStudent' | 'saveCourseRecord' | 'removeCourseRecord'>;
  student: StudentSummary;
  courses: CourseRecord[];
  onSaved: () => void;
}) {
  if (student.synthetic) return <Notice>Synthetic records are managed by the seeding workflow and cannot be edited here.</Notice>;
  return (
    <div className="record-editor">
      <section aria-labelledby="edit-details-heading">
        <h3 id="edit-details-heading">Details</h3>
        <StudentDetailsForm initial={student} submitLabel="Save details" onSubmit={async details => {
          const { studentId: _id, ...changes } = details;
          const { changed } = await api.updateStudent(student.studentId, changes);
          onSaved();
          return changed.length ? `Saved: ${changed.join(', ')}.` : 'Nothing changed.';
        }} />
      </section>
      <section aria-labelledby="edit-courses-heading">
        <h3 id="edit-courses-heading">Course records</h3>
        <p className="caption">Correct a grade, add a retake or record a new course. Every change is recorded in the audit log.</p>
        <CourseRecordEditor api={api} studentId={student.studentId} courses={courses} onSaved={onSaved} />
      </section>
    </div>
  );
}
