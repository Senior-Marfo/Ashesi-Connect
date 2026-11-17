import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ADMIN_PASSWORD, buildTestApp } from '../testing/fixtures.js';

async function setup() {
  const built = await buildTestApp();
  built.store.students.push({ studentId: '92800001', fullName: 'Synthetic Seeded', programme: 'CS', yearGroup: 2028, track: 'standard', synthetic: true });
  const token = (await request(built.app).post('/api/v1/auth/login').send({ identifier: 'STF-1001', password: ADMIN_PASSWORD })).body.accessToken as string;
  const as = <T extends request.Test>(test: T) => test.auth(token, { type: 'bearer' });
  return { ...built, as };
}
const newStudent = { studentId: '20310001', fullName: 'Yaa Asantewaa', programme: 'mis', yearGroup: 2031, track: 'Pre-Calculus' };

describe('manual student records', () => {
  it('creates a student with a locked account and logs it', async () => {
    const { app, as, store } = await setup();
    const created = await as(request(app).post('/api/v1/admin/records/students')).send(newStudent);
    expect(created.status).toBe(201);
    expect(created.body).toEqual({ student: { studentId: '20310001', fullName: 'Yaa Asantewaa', programme: 'MIS', yearGroup: 2031, track: 'pre-calculus' }, accountCreated: true });
    expect(store.users.find(user => user.identifier === '20310001')).toMatchObject({ role: 'STUDENT', studentId: '20310001', forcePasswordChange: true });
    expect(store.auditLog.find(entry => entry.action === 'ADMIN_STUDENT_CREATED')).toMatchObject({ subject: '20310001', actorId: 'u-admin-1' });
    expect((await request(app).post('/api/v1/auth/login').send({ identifier: '20310001', password: 'Anything-At-All-1' })).status).toBe(401);
  });

  it('refuses duplicates, bad IDs and invalid details with a readable reason', async () => {
    const { app, as } = await setup();
    expect((await as(request(app).post('/api/v1/admin/records/students')).send({ ...newStudent, studentId: '20260001' })).status).toBe(409);
    for (const [body, message] of [
      [{ ...newStudent, studentId: 'abc' }, 'That is not a valid student ID.'],
      [{ ...newStudent, programme: 'PHYS' }, /Choose a programme/],
      [{ ...newStudent, track: 'fast' }, /Choose a track/],
      [{ ...newStudent, fullName: ' ' }, 'A name is required.'],
      [{ ...newStudent, yearGroup: '2031' }, 'The year group must be a year.']
    ] as const) {
      const response = await as(request(app).post('/api/v1/admin/records/students')).send(body);
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(message);
    }
  });

  it('edits only changed details and records before and after', async () => {
    const { app, as, store } = await setup();
    const response = await as(request(app).patch('/api/v1/admin/records/students/20260001')).send({ fullName: 'Synthetic Student One', track: 'pre-calculus' });
    expect(response.body).toEqual({ student: { studentId: '20260001', fullName: 'Synthetic Student One', programme: 'CS', yearGroup: 2028, track: 'pre-calculus' }, changed: ['track'] });
    expect(store.students.find(student => student.studentId === '20260001')?.track).toBe('pre-calculus');
    expect(store.auditLog.find(entry => entry.action === 'ADMIN_STUDENT_UPDATED')?.metadata).toEqual({ track: 'pre-calculus', 'previous.track': 'standard' });
    expect((await as(request(app).patch('/api/v1/admin/records/students/20260001')).send({})).status).toBe(400);
    expect((await as(request(app).patch('/api/v1/admin/records/students/missing')).send({ fullName: 'X' })).status).toBe(404);
  });
});

describe('manual course records', () => {
  const course = (path: string) => `/api/v1/admin/records/students/20260001/courses/${encodeURIComponent(path)}`;

  it('adds, replaces and removes a course with its attempt history, logging each change', async () => {
    const { app, as, store } = await setup();
    const added = await as(request(app).put(course('math141'))).send({ attempts: [{ credits: 1, status: 'COMPLETED', grade: 'e', semester: '2024 Fall' }, { credits: 1, status: 'ENROLLED', semester: '2025 Spring' }] });
    expect(added.status).toBe(201);
    expect(added.body.course).toEqual({ courseCode: 'MATH 141', attempts: [{ credits: 1, status: 'COMPLETED', grade: 'E', semester: '2024 Fall' }, { credits: 1, status: 'ENROLLED', semester: '2025 Spring' }] });

    const replaced = await as(request(app).put(course('MATH 141'))).send({ attempts: [{ credits: 1, status: 'COMPLETED', grade: 'E' }, { credits: 1, status: 'COMPLETED', grade: 'B' }] });
    expect(replaced.status).toBe(200);
    expect(store.courses.get('20260001')?.find(c => c.courseCode === 'MATH 141')?.attempts.map(a => a.grade)).toEqual(['E', 'B']);

    expect((await as(request(app).delete(course('MATH 141')))).status).toBe(204);
    expect(store.courses.get('20260001')?.map(c => c.courseCode)).toEqual(['CS 111']);
    expect((await as(request(app).delete(course('MATH 141')))).status).toBe(404);

    expect(store.auditLog.filter(entry => entry.action.startsWith('ADMIN_COURSE_RECORD')).map(entry => [entry.action, entry.metadata])).toEqual([
      ['ADMIN_COURSE_RECORD_UPDATED', { courseCode: 'MATH 141', attempts: 'E > enrolled', previous: 'none' }],
      ['ADMIN_COURSE_RECORD_UPDATED', { courseCode: 'MATH 141', attempts: 'E > B', previous: 'E > enrolled' }],
      ['ADMIN_COURSE_RECORD_REMOVED', { courseCode: 'MATH 141', previous: 'E > B' }]
    ]);
  });

  it('refuses attempts that contradict their status or come out of order', async () => {
    const { app, as } = await setup();
    for (const [attempts, message] of [
      [[], 'Add at least one attempt.'],
      [[{ credits: 1, status: 'COMPLETED' }], 'A completed attempt needs a grade.'],
      [[{ credits: 1, status: 'ENROLLED', grade: 'A' }], 'An attempt that is enrolled cannot have a grade.'],
      [[{ credits: 1, status: 'ENROLLED' }, { credits: 1, status: 'COMPLETED', grade: 'A' }], 'Only the latest attempt can be in progress or incomplete.'],
      [[{ credits: 0.3, status: 'COMPLETED', grade: 'A' }], 'Credits go in steps of 0.5.'],
      [[{ credits: 1, status: 'COMPLETED', grade: 'A', semester: 'Fall 2025' }], 'Terms look like “2025 Fall”.'],
      [[{ credits: 1, status: 'COMPLETED', grade: 'F' }], 'Grades are A+, A, B+, B, C+, C, D+, D, E.']
    ] as const) {
      const response = await as(request(app).put(course('CS 212'))).send({ attempts });
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(message);
    }
    expect((await as(request(app).put(course('CS212X1'))).send({ attempts: [{ credits: 1, status: 'ENROLLED' }] })).body.message).toBe('Course codes look like “CS 111”.');
  });

  it('never changes synthetic records', async () => {
    const { app, as, store } = await setup();
    const synthetic = '/api/v1/admin/records/students/92800001';
    for (const response of [
      await as(request(app).patch(synthetic)).send({ fullName: 'Changed' }),
      await as(request(app).put(`${synthetic}/courses/CS%20111`)).send({ attempts: [{ credits: 1, status: 'ENROLLED' }] }),
      await as(request(app).delete(`${synthetic}/courses/CS%20111`))
    ]) {
      expect(response.status).toBe(409);
      expect(response.body.error).toBe('SYNTHETIC_RECORD');
    }
    expect(store.students.find(student => student.studentId === '92800001')?.fullName).toBe('Synthetic Seeded');
    expect(store.courses.has('92800001')).toBe(false);
  });
});
