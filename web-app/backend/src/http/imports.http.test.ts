import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ADMIN_PASSWORD, STUDENT_PASSWORD, buildTestApp } from '../testing/fixtures.js';

const STUDENTS = 'studentId,fullName,programme,yearGroup,track\n20290001,Kwame Real,CS,2029,standard\n20260001,Renamed Student,CS,2028,standard\n';
const COURSES = 'studentId,courseCode,credits,grade,status,semester\n20290001,CS 111,1,B,,2025 Fall\n20260001,CS 111,1,A,,2025 Fall\n';

async function setup() {
  const built = await buildTestApp();
  const token = (await request(built.app).post('/api/v1/auth/login').send({ identifier: 'STF-1001', password: ADMIN_PASSWORD })).body.accessToken as string;
  const post = (path: string, body: object) => request(built.app).post(`/api/v1/admin/imports${path}`).auth(token, { type: 'bearer' }).send(body);
  return { ...built, token, post };
}

describe('record imports', () => {
  it('previews without writing, then applies students all at once with locked accounts for new ones', async () => {
    const { post, store, app } = await setup();
    const preview = await post('/preview', { kind: 'STUDENTS', filename: 'students.csv', content: STUDENTS });
    expect(preview.body).toMatchObject({ rows: 2, created: 1, updated: 1, errorCount: 0 });
    expect(store.students.find(s => s.studentId === '20290001')).toBeUndefined();

    const applied = await post('', { kind: 'STUDENTS', filename: 'students.csv', content: STUDENTS });
    expect(applied.status).toBe(201);
    expect(applied.body.batch).toMatchObject({ kind: 'STUDENTS', created: 1, updated: 1, status: 'APPLIED' });
    expect(applied.body.batch.undo).toBeUndefined();
    expect(store.students.find(s => s.studentId === '20260001')).toMatchObject({ fullName: 'Renamed Student' });
    expect(store.users.find(u => u.identifier === '20290001')).toMatchObject({ role: 'STUDENT', forcePasswordChange: true });
    // Nobody knows the placeholder password, so the account is unusable until an admin issues a temporary one.
    expect((await request(app).post('/api/v1/auth/login').send({ identifier: '20290001', password: STUDENT_PASSWORD })).status).toBe(401);
    expect(store.auditLog.find(e => e.action === 'ADMIN_IMPORT_APPLIED')?.metadata).toMatchObject({ kind: 'STUDENTS', created: 1 });
  });

  it('refuses a file with any error and writes nothing', async () => {
    const { post, store } = await setup();
    const bad = await post('', { kind: 'STUDENTS', filename: 'students.csv', content: `${STUDENTS}bad,,XX,0\n` });
    expect(bad.status).toBe(422);
    expect(bad.body.preview.errorCount).toBe(4);
    expect(store.students).toHaveLength(2);
    expect(store.imports).toHaveLength(0);
  });

  it('imports course attempts for known students and undoes the latest batch exactly', async () => {
    const { post, store, token, app } = await setup();
    await post('', { kind: 'STUDENTS', filename: 'students.csv', content: STUDENTS });
    const unknown = await post('/preview', { kind: 'COURSES', filename: 'c.csv', content: 'studentId,courseCode,credits,grade\n20999999,CS 111,1,A' });
    expect(unknown.body.errors[0].message).toContain('not a known student');

    const courses = await post('', { kind: 'COURSES', filename: 'courses.csv', content: COURSES });
    expect(courses.body.batch).toMatchObject({ rows: 2, created: 1, updated: 1 });
    expect(store.courses.get('20260001')?.find(c => c.courseCode === 'CS 111')?.attempts[0].grade).toBe('A');

    const history = await request(app).get('/api/v1/admin/imports').auth(token, { type: 'bearer' });
    expect(history.body.batches.map((b: { kind: string; canUndo: boolean }) => [b.kind, b.canUndo])).toEqual([['COURSES', true], ['STUDENTS', false]]);
    const studentsBatch = history.body.batches[1].id;
    expect((await post(`/${studentsBatch}/rollback`, {})).status).toBe(409);

    expect((await post(`/${history.body.batches[0].id}/rollback`, {})).body).toEqual({ status: 'ROLLED_BACK' });
    expect(store.courses.get('20260001')?.find(c => c.courseCode === 'CS 111')?.attempts[0].grade).toBe('B+');
    expect(store.courses.get('20290001')).toBeUndefined();

    expect((await post(`/${studentsBatch}/rollback`, {})).body).toEqual({ status: 'ROLLED_BACK' });
    expect(store.students.find(s => s.studentId === '20260001')).toMatchObject({ fullName: 'Synthetic Student One', yearGroup: 2028 });
    expect(store.students.find(s => s.studentId === '20290001')).toBeUndefined();
    expect(store.users.find(u => u.identifier === '20290001')).toBeUndefined();
    expect(store.auditLog.filter(e => e.action === 'ADMIN_IMPORT_ROLLED_BACK')).toHaveLength(2);
  });

  it('keeps real imports apart from synthetic records', async () => {
    const { post, store } = await setup();
    Object.assign(store.students[0], { synthetic: true });
    const preview = await post('/preview', { kind: 'STUDENTS', filename: 's.csv', content: STUDENTS });
    expect(preview.body.errors.some((e: { message: string }) => e.message.includes('synthetic'))).toBe(true);
  });

  it('accepts only CSV files of reasonable size', async () => {
    const { post } = await setup();
    expect((await post('/preview', { kind: 'STUDENTS', filename: 'students.xlsx', content: STUDENTS })).body.message).toBe('Only .csv files are accepted');
    expect((await post('/preview', { kind: 'STUDENTS', filename: 'big.csv', content: 'x'.repeat(4_000_001) })).status).toBe(400);
  });
});
