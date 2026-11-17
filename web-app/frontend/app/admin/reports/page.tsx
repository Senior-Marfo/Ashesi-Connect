'use client';
import { useMemo, useState } from 'react';
import { ADMIN_NAV, AppShell, FullPageLoading, Notice, SkeletonRows } from '../../../components/app-shell';
import { ColumnChart, MeterList, StandingSplit } from '../../../components/charts';
import { GRADE_SCALE, NON_COMPLETION_REASONS, type NonCompletionReason, type ReportFilters, type Reports } from '../../../lib/api';
import { saveBlob } from '../../../lib/download';
import { useRequireRole, useSession } from '../../../lib/session';
import { useLoad } from '../../../lib/use-load';

const PROGRAMMES = ['BA', 'ECON', 'LLB', 'MIS', 'CS', 'CE', 'EE', 'ME', 'MT', 'BE'];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_GROUPS = Array.from({ length: 8 }, (_, index) => CURRENT_YEAR - 3 + index);
const MIN_COURSE_STUDENTS = 5;

const REASON_LABELS: Record<NonCompletionReason, string> = {
  FAILED_COURSE: 'Failed course not retaken',
  INCOMPLETE_COURSE: 'Incomplete course',
  REQUIRED_COURSE_NOT_TAKEN: 'Required course not taken',
  CAPSTONE_OUTSTANDING: 'Capstone outstanding',
  ELECTIVES_SHORT: 'Electives short',
  CREDIT_SHORTFALL: 'Total credits short',
  STILL_IN_PROGRESS: 'Courses still in progress'
};

type Section = 'cohorts' | 'programmes' | 'courses';

function SectionHead({ id, title, onExport }: { id: string; title: string; onExport?: () => void }) {
  return (
    <div className="report-head">
      <h2 id={id} className="section-title">{title}</h2>
      {onExport && <button type="button" className="button ghost no-print" onClick={onExport}>CSV</button>}
    </div>
  );
}

function ReportBody({ reports, exportCsv }: { reports: Reports; exportCsv: (section: Section) => void }) {
  const eligibleCourses = reports.courses.filter(course => course.students >= MIN_COURSE_STUDENTS && course.firstAttemptPassRate !== null);
  const hardest = [...eligibleCourses].sort((a, b) => (a.firstAttemptPassRate ?? 0) - (b.firstAttemptPassRate ?? 0)).slice(0, 8);
  const mostRetaken = [...reports.courses].filter(course => course.retakes > 0).sort((a, b) => b.retakes - a.retakes || a.courseCode.localeCompare(b.courseCode)).slice(0, 8);
  const [gradeCourse, setGradeCourse] = useState('');
  const selectedCourse = reports.courses.find(course => course.courseCode === gradeCourse) ?? hardest[0] ?? reports.courses[0];
  const reasonTotals = useMemo(() => {
    const totals = Object.fromEntries(NON_COMPLETION_REASONS.map(reason => [reason, 0])) as Record<NonCompletionReason, number>;
    for (const cohort of reports.cohortOutcomes) for (const reason of NON_COMPLETION_REASONS) totals[reason] += cohort.reasons[reason];
    return NON_COMPLETION_REASONS.map(reason => ({ reason, count: totals[reason] })).filter(item => item.count > 0).sort((a, b) => b.count - a.count);
  }, [reports]);
  const notMet = reports.cohortOutcomes.reduce((sum, cohort) => sum + cohort.assessed - cohort.requirementsMet, 0);

  if (reports.totals.students === 0) return <p className="empty">No students match these filters.</p>;
  return (
    <>
      <dl className="figures report-kpis">
        <div><dt>Students</dt><dd>{reports.totals.students}</dd></div>
        <div><dt>Assessed</dt><dd>{reports.totals.assessed}</dd></div>
        <div><dt>Graduated cohorts</dt><dd>{reports.totals.graduatedCohorts.length ? reports.totals.graduatedCohorts.join(', ') : '—'}</dd></div>
      </dl>

      <section className="report-section" aria-labelledby="standing-now">
        <SectionHead id="standing-now" title="Standing now" />
        <StandingSplit counts={reports.standings} />
      </section>

      <section className="report-section" aria-labelledby="outcomes">
        <SectionHead id="outcomes" title="Graduation outcomes by year group" onExport={() => exportCsv('cohorts')} />
        <p className="caption">Share of assessed students in each graduated year group who met every requirement: an advisory proxy for the graduation rate. Year groups side by side give the year-on-year comparison.</p>
        {reports.cohortOutcomes.length === 0 ? <p className="empty">No graduated year groups in this selection.</p> : (
          <>
            <MeterList label="Completion rate by year group" rows={reports.cohortOutcomes.map(cohort => ({
              key: String(cohort.yearGroup), label: `Class of ${cohort.yearGroup}`, value: cohort.completionRate, max: 100,
              display: `${cohort.completionRate}% · ${cohort.requirementsMet} of ${cohort.assessed}`
            }))} />
            {notMet > 0 && (
              <>
                <h3 className="subhead">Why requirements were not met <span className="muted">({notMet} students; a student can have several reasons)</span></h3>
                <MeterList label="Reasons requirements were not met" rows={reasonTotals.map(item => ({
                  key: item.reason, label: REASON_LABELS[item.reason], value: item.count, max: notMet, display: `${item.count}`
                }))} />
              </>
            )}
          </>
        )}
      </section>

      {reports.cohortProgress.length > 0 && (
        <section className="report-section" aria-labelledby="progress">
          <SectionHead id="progress" title="Progress of current year groups" />
          <table className="courses report-table">
            <thead><tr><th scope="col">Year group</th><th scope="col" className="num">Students</th><th scope="col">Average complete</th><th scope="col">Standing</th></tr></thead>
            <tbody>
              {reports.cohortProgress.map(cohort => (
                <tr key={cohort.yearGroup}>
                  <th scope="row">{cohort.yearGroup}</th>
                  <td className="num">{cohort.students}</td>
                  <td><MeterList label={`Average complete, ${cohort.yearGroup}`} rows={[{ key: 'avg', label: '', value: cohort.averagePercentComplete, max: 100, display: `${cohort.averagePercentComplete}%` }]} /></td>
                  <td><StandingSplit counts={cohort.standings} compact /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {reports.projections.length > 0 && (
        <section className="report-section" aria-labelledby="outlook">
          <SectionHead id="outlook" title="Outlook for current year groups" />
          <p className="caption">Credits still to complete after courses in progress, and where each year group is heading against its planned graduation term, judged by advisory standing.</p>
          <div className="outlook">
            <div>
              <h3 className="subhead">Credits still to complete</h3>
              <ColumnChart label="Students by credits still to complete" data={Object.entries(reports.creditsRemaining).map(([key, value]) => ({ key, value }))} />
            </div>
            <div>
              <h3 className="subhead">Projected graduation</h3>
              <table className="courses report-table">
                <thead><tr><th scope="col">Planned term</th><th scope="col" className="num">On plan</th><th scope="col" className="num">At risk</th><th scope="col" className="num">Likely later</th></tr></thead>
                <tbody>
                  {reports.projections.map(projection => (
                    <tr key={projection.yearGroup}>
                      <th scope="row">{projection.term}</th>
                      <td className="num">{projection.onPlan}</td>
                      <td className="num">{projection.atRisk}</td>
                      <td className="num">{projection.likelyLater}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="report-section" aria-labelledby="programmes">
        <SectionHead id="programmes" title="Programme comparison" onExport={() => exportCsv('programmes')} />
        <div className="table-wrap">
          <table className="courses report-table">
            <thead><tr><th scope="col">Programme</th><th scope="col" className="num">Students</th><th scope="col" className="num">Avg passed credits</th><th scope="col">Completion (graduated)</th><th scope="col">Standing</th></tr></thead>
            <tbody>
              {reports.programmes.map(programme => (
                <tr key={programme.programme}>
                  <th scope="row">{programme.programme}</th>
                  <td className="num">{programme.students}</td>
                  <td className="num">{programme.averagePassedCredits}</td>
                  <td><MeterList label={`Completion, ${programme.programme}`} rows={[{ key: 'rate', label: '', value: programme.completionRate, max: 100, display: `${programme.completionRate}%` }]} /></td>
                  <td><StandingSplit counts={programme.standings} compact /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="caption">Standing bars: critical, at risk, on track, not determined, left to right. Hover a bar for counts, or download the CSV.</p>
      </section>

      <section className="report-section" aria-labelledby="courses">
        <SectionHead id="courses" title="Courses" onExport={() => exportCsv('courses')} />
        <p className="caption">Pass rates use each course’s pass mark (D+ unless set under Settings). Courses with fewer than {MIN_COURSE_STUDENTS} students are left out of the rankings.</p>
        <div className="report-columns">
          <div>
            <h3 className="subhead">Lowest first-attempt pass rate</h3>
            <MeterList label="Lowest first-attempt pass rates" rows={hardest.map(course => ({ key: course.courseCode, label: course.courseCode, value: course.firstAttemptPassRate, max: 100, display: `${course.firstAttemptPassRate}%`, hint: `${course.courseCode}: ${course.students} students, ${course.unresolvedFailures} failed and not retaken` }))} />
          </div>
          <div>
            <h3 className="subhead">Most often retaken</h3>
            {mostRetaken.length === 0 ? <p className="muted">No retakes in this selection.</p> : (
              <MeterList label="Most retaken courses" rows={mostRetaken.map(course => ({ key: course.courseCode, label: course.courseCode, value: course.retakes, max: mostRetaken[0].retakes, display: `${course.retakes} student${course.retakes === 1 ? '' : 's'}` }))} />
            )}
          </div>
        </div>
        {selectedCourse && (
          <div className="grade-distribution">
            <div className="report-head">
              <h3 className="subhead">Grade distribution</h3>
              <label className="field inline no-print">Course
                <select className="input" value={selectedCourse.courseCode} onChange={event => setGradeCourse(event.target.value)}>
                  {reports.courses.map(course => <option key={course.courseCode} value={course.courseCode}>{course.courseCode}</option>)}
                </select>
              </label>
            </div>
            <p className="caption">{selectedCourse.courseCode}: every graded attempt, {selectedCourse.attempts} attempts by {selectedCourse.students} students.</p>
            <ColumnChart label={`Grades in ${selectedCourse.courseCode}`} data={GRADE_SCALE.map(grade => ({ key: grade, value: selectedCourse.grades[grade] }))} />
          </div>
        )}
      </section>
      <section className="report-section" aria-labelledby="reach">
        <SectionHead id="reach" title="Messaging reach" />
        <p className="caption">Every message delivered so far, whatever the filters above. Scheduled messages count once they go out.</p>
        <dl className="figures">
          <div><dt>Messages delivered</dt><dd>{reports.messaging.messages}</dd></div>
          <div><dt>Deliveries</dt><dd>{reports.messaging.recipients}</dd></div>
          <div><dt>Read</dt><dd>{reports.messaging.readRate === null ? '—' : `${reports.messaging.readRate}%`}</dd></div>
        </dl>
      </section>
    </>
  );
}

export default function ReportsPage() {
  const session = useRequireRole('ADMIN');
  const { api } = useSession();
  const [filters, setFilters] = useState<ReportFilters>({});
  const [exportError, setExportError] = useState(false);
  const load = useLoad(() => api.reports(filters), Boolean(session), JSON.stringify(filters));
  if (!session) return <FullPageLoading />;

  async function exportCsv(section: Section) {
    setExportError(false);
    try {
      saveBlob(await api.reportCsv(section, filters), `report-${section}.csv`);
    } catch {
      setExportError(true);
    }
  }

  const scope = [filters.programme ?? 'All programmes', filters.yearGroup ? `year group ${filters.yearGroup}` : 'all year groups'].join(' · ');
  return (
    <AppShell eyebrow="Registry workspace" title="Reports" nav={ADMIN_NAV}>
      <p className="caption">Advisory figures from course records and the same assessment students see. Not official graduation statistics. {scope}.{load.status === 'ready' && ` Generated ${new Date(load.data.generatedAt).toLocaleString()}.`}</p>
      <div className="filters no-print" role="group" aria-label="Filters">
        <label className="field">Programme
          <select className="input" value={filters.programme ?? ''} onChange={event => setFilters(current => ({ ...current, programme: event.target.value || undefined }))}>
            <option value="">All programmes</option>
            {PROGRAMMES.map(code => <option key={code} value={code}>{code}</option>)}
          </select>
        </label>
        <label className="field">Year group
          <select className="input" value={filters.yearGroup ?? ''} onChange={event => setFilters(current => ({ ...current, yearGroup: event.target.value ? Number(event.target.value) : undefined }))}>
            <option value="">All year groups</option>
            {YEAR_GROUPS.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <button type="button" className="button ghost" onClick={() => window.print()} disabled={load.status !== 'ready'}>Print or save PDF</button>
      </div>
      {exportError && <Notice tone="error">The CSV could not be downloaded. Try again.</Notice>}
      {load.status === 'loading' && <SkeletonRows rows={10} />}
      {load.status === 'error' && <Notice tone="error">Reports could not be generated. Refresh the page to try again.</Notice>}
      {load.status === 'ready' && <ReportBody reports={load.data} exportCsv={section => void exportCsv(section)} />}
    </AppShell>
  );
}
