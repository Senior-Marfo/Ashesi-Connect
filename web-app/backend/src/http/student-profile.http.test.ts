import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ADMIN_PASSWORD, STUDENT_PASSWORD, buildTestApp } from '../testing/fixtures.js';

async function setup() {
  const built = await buildTestApp();
  const login = (identifier: string, password: string) => request(built.app).post('/api/v1/auth/login').send({ identifier, password }).then(response => response.body.accessToken as string);
  return { ...built, admin: await login('STF-1001', ADMIN_PASSWORD), student: await login('20260001', STUDENT_PASSWORD) };
}

describe('US-06 admin student search', () => {
  it('finds students by ID prefix, by name and despite a typo, labelling each match', async () => {
    const { app, admin } = await setup();
    const search = async (q: string) => (await request(app).get('/api/v1/admin/students').query({ q }).auth(admin, { type: 'bearer' })).body.students as Array<{ studentId: string; match: string }>;
    expect((await search('202600')).map(s => [s.studentId, s.match])).toEqual([['20260001', 'ID'], ['20260002', 'ID']]);
    expect((await search('student two')).map(s => [s.studentId, s.match])).toEqual([['20260002', 'NAME']]);
    expect((await search('20206001')).map(s => [s.studentId, s.match])).toEqual([['20260001', 'CLOSE_ID']]);
    expect((await search('synthtic')).map(s => s.match)).toEqual(['CLOSE_NAME', 'CLOSE_NAME']);
  });

  it('rejects characters that cannot appear in an ID or a name', async () => {
    const { app, admin } = await setup();
    for (const q of ['.*', '$where', 'a{1}']) expect((await request(app).get('/api/v1/admin/students').query({ q }).auth(admin, { type: 'bearer' })).status).toBe(400);
  });
});

describe('US-06 admin student profile', () => {
  it('adds staff notes with their author, newest first, and logs each addition', async () => {
    const { app, admin, store } = await setup();
    const add = (body: object) => request(app).post('/api/v1/admin/students/20260001/notes').auth(admin, { type: 'bearer' }).send(body);
    expect((await add({ body: 'Advised to retake MATH 141 in spring.' })).status).toBe(201);
    const second = await add({ body: '  Capstone supervisor confirmed.  ' });
    expect(second.body.note).toMatchObject({ body: 'Capstone supervisor confirmed.', author: 'STF-1001', studentId: '20260001' });
    expect(second.body.note.authorId).toBeUndefined();

    const listed = await request(app).get('/api/v1/admin/students/20260001/notes').auth(admin, { type: 'bearer' });
    expect(listed.body.notes.map((note: { body: string }) => note.body)).toEqual(['Capstone supervisor confirmed.', 'Advised to retake MATH 141 in spring.']);
    expect((await request(app).get('/api/v1/admin/students/20260002/notes').auth(admin, { type: 'bearer' })).body.notes).toEqual([]);
    expect(store.auditLog.filter(entry => entry.action === 'ADMIN_STUDENT_NOTE_ADDED' && entry.subject === '20260001')).toHaveLength(2);
  });

  it('refuses empty or oversized notes and unknown students', async () => {
    const { app, admin } = await setup();
    for (const body of [{}, { body: '   ' }, { body: 'x'.repeat(2001) }]) {
      expect((await request(app).post('/api/v1/admin/students/20260001/notes').auth(admin, { type: 'bearer' }).send(body)).status).toBe(400);
    }
    expect((await request(app).post('/api/v1/admin/students/missing/notes').auth(admin, { type: 'bearer' }).send({ body: 'Hi' })).status).toBe(404);
    expect((await request(app).get('/api/v1/admin/students/missing/messages').auth(admin, { type: 'bearer' })).status).toBe(404);
  });

  it('shows the messages a student received and whether they read them', async () => {
    const { app, admin, student } = await setup();
    await request(app).post('/api/v1/admin/messages').auth(admin, { type: 'bearer' })
      .send({ title: 'Audit review', body: 'Please check your record.', audience: { kind: 'STUDENTS', studentIds: ['20260001'] } });
    const unread = await request(app).get('/api/v1/admin/students/20260001/messages').auth(admin, { type: 'bearer' });
    expect(unread.body.messages).toHaveLength(1);
    expect(unread.body.messages[0]).toMatchObject({ title: 'Audit review' });
    expect(unread.body.messages[0].readAt).toBeUndefined();

    await request(app).post('/api/v1/students/me/messages/read-all').auth(student, { type: 'bearer' });
    const read = await request(app).get('/api/v1/admin/students/20260001/messages').auth(admin, { type: 'bearer' });
    expect(read.body.messages[0].readAt).toBeTruthy();
    expect((await request(app).get('/api/v1/admin/students/20260002/messages').auth(admin, { type: 'bearer' })).body.messages).toEqual([]);
  });

  it('logs each audit export against the student', async () => {
    const { app, admin, store } = await setup();
    expect((await request(app).post('/api/v1/admin/students/20260002/audit-export').auth(admin, { type: 'bearer' })).status).toBe(204);
    expect(store.auditLog.find(entry => entry.action === 'ADMIN_AUDIT_EXPORTED')).toMatchObject({ subject: '20260002', actorId: 'u-admin-1' });
    expect((await request(app).post('/api/v1/admin/students/missing/audit-export').auth(admin, { type: 'bearer' })).status).toBe(404);
  });

  it('never shows staff notes to the student', async () => {
    const { app, admin, student } = await setup();
    await request(app).post('/api/v1/admin/students/20260001/notes').auth(admin, { type: 'bearer' }).send({ body: 'Confidential advising note.' });
    for (const path of ['/api/v1/students/me', '/api/v1/students/me/eligibility', '/api/v1/students/me/messages']) {
      expect(JSON.stringify((await request(app).get(path).auth(student, { type: 'bearer' })).body)).not.toContain('Confidential advising note.');
    }
  });
});
