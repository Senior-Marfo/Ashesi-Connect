import type { ReactNode } from 'react';
import type { CourseAttempt, CourseRecord, StudentRecord } from '../lib/api';

const statusLabel: Record<CourseAttempt['status'], string> = {
  COMPLETED: 'Graded',
  ENROLLED: 'In progress',
  INCOMPLETE: 'Incomplete'
};

const latest = (course: CourseRecord): CourseAttempt | undefined => course.attempts[course.attempts.length - 1];

export function creditTotals(courses: CourseRecord[]) {
  let graded = 0;
  let inProgress = 0;
  for (const course of courses) {
    const attempt = latest(course);
    if (attempt?.status === 'COMPLETED') graded += attempt.credits;
    if (attempt?.status === 'ENROLLED') inProgress += attempt.credits;
  }
  return { graded, inProgress };
}

export function StudentProfile({ record, children }: { record: StudentRecord; children?: ReactNode }) {
  const { student, courses } = record;
  const totals = creditTotals(courses);
  return (
    <>
      <dl className="facts">
        <div><dt>Student ID</dt><dd className="mono">{student.studentId}</dd></div>
        <div><dt>Programme</dt><dd>{student.programme}</dd></div>
        <div><dt>Year group</dt><dd>{student.yearGroup}</dd></div>
        <div><dt>Track</dt><dd>{student.track}</dd></div>
      </dl>
      <dl className="figures">
        <div><dt>Graded credits</dt><dd>{totals.graded}</dd></div>
        <div><dt>In progress</dt><dd>{totals.inProgress}</dd></div>
        <div><dt>Courses on record</dt><dd>{courses.length}</dd></div>
      </dl>
      <p className="caption">
        These figures summarise recorded courses only. They are not a graduation decision: pass marks and programme requirements are still awaiting Registry confirmation.
      </p>
      {children}
      <CourseTable courses={courses} />
    </>
  );
}

export function CourseTable({ courses }: { courses: CourseRecord[] }) {
  if (courses.length === 0) {
    return <p className="empty">No courses are on record yet.</p>;
  }
  return (
    <div className="table-wrap">
      <table className="courses">
        <caption className="visually-hidden">Courses and grades</caption>
        <thead>
          <tr><th scope="col">Course</th><th scope="col">Latest grade</th><th scope="col">Status</th><th scope="col" className="wide-only">Semester</th><th scope="col" className="num">Credits</th></tr>
        </thead>
        <tbody>
          {courses.map(course => {
            const attempt = latest(course);
            const history = course.attempts.slice(0, -1);
            return (
              <tr key={course.courseCode}>
                <th scope="row">
                  <span className="mono code">{course.courseCode}</span>
                  {attempt?.semester && <span className="history narrow-only">{attempt.semester}</span>}
                  {history.length > 0 && (
                    <span className="history">
                      Earlier: {history.map(previous => `${previous.grade ?? statusLabel[previous.status]}${previous.semester ? ` (${previous.semester})` : ''}`).join(', ')}
                    </span>
                  )}
                </th>
                <td className="grade">{attempt?.grade ?? '—'}</td>
                <td><span className={`chip ${attempt?.status.toLowerCase() ?? ''}`}>{attempt ? statusLabel[attempt.status] : 'No attempt'}</span></td>
                <td className="wide-only">{attempt?.semester ?? '—'}</td>
                <td className="num">{attempt?.credits ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
