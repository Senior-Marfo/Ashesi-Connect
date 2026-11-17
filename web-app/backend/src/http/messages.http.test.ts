import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ADMIN_PASSWORD, STUDENT_PASSWORD, buildTestApp } from '../testing/fixtures.js';

type Built = Awaited<ReturnType<typeof buildTestApp>>;
const login = async (app: Built['app'], identifier: string, password: string) =>
  (await request(app).post('/api/v1/auth/login').send({ identifier, password })).body.accessToken as string;

async function setup() {
  const built = await buildTestApp();
  return { ...built, admin: await login(built.app, 'STF-1001', ADMIN_PASSWORD), one: await login(built.app, '20260001', STUDENT_PASSWORD), two: await login(built.app, '20260002', STUDENT_PASSWORD) };
}

describe('messaging', () => {
  it('previews and sends to a programme; only targeted students receive it', async () => {
    const { app, admin, one, two, store } = await setup();
    const preview = await request(app).post('/api/v1/admin/messages/preview').auth(admin, { type: 'bearer' }).send({ audience: { kind: 'PROGRAMME', programme: 'BA' } });
    expect(preview.body).toEqual({ recipientCount: 1, unknownIds: [] });

    const sent = await request(app).post('/api/v1/admin/messages').auth(admin, { type: 'bearer' })
      .send({ title: 'BA audit review', body: 'Please check your record.', priority: 'HIGH', audience: { kind: 'PROGRAMME', programme: 'BA' } });
    expect(sent.status).toBe(201);
    expect(sent.body.message).toMatchObject({ recipientCount: 1, priority: 'HIGH' });
    expect(store.auditLog.find(entry => entry.action === 'ADMIN_MESSAGE_SENT')?.metadata).toMatchObject({ audience: 'PROGRAMME', recipients: 1 });

    const twoInbox = await request(app).get('/api/v1/students/me/messages').auth(two, { type: 'bearer' });
    expect(twoInbox.body.unread).toBe(1);
    expect(twoInbox.body.messages[0]).toMatchObject({ title: 'BA audit review', priority: 'HIGH' });
    const oneInbox = await request(app).get('/api/v1/students/me/messages').auth(one, { type: 'bearer' });
    expect(oneInbox.body).toEqual({ messages: [], unread: 0 });
  });

  it('tracks reads per student and reports reach to admins', async () => {
    const { app, admin, one, two } = await setup();
    const { body } = await request(app).post('/api/v1/admin/messages').auth(admin, { type: 'bearer' })
      .send({ title: 'Everyone', body: 'Registration opens Monday.', audience: { kind: 'ALL_STUDENTS' } });
    expect(body.message.priority).toBe('NORMAL');

    expect((await request(app).post(`/api/v1/students/me/messages/${body.message.id}/read`).auth(one, { type: 'bearer' })).body).toEqual({ marked: 1 });
    expect((await request(app).get('/api/v1/students/me/messages/unread-count').auth(one, { type: 'bearer' })).body).toEqual({ unread: 0 });
    expect((await request(app).get('/api/v1/students/me/messages/unread-count').auth(two, { type: 'bearer' })).body).toEqual({ unread: 1 });

    const sent = await request(app).get('/api/v1/admin/messages').auth(admin, { type: 'bearer' });
    expect(sent.body.messages[0]).toMatchObject({ title: 'Everyone', recipientCount: 2, readCount: 1 });

    expect((await request(app).post('/api/v1/students/me/messages/read-all').auth(two, { type: 'bearer' })).body).toEqual({ marked: 1 });
  });

  it('cannot mark another student’s message as read', async () => {
    const { app, admin, one, two } = await setup();
    const { body } = await request(app).post('/api/v1/admin/messages').auth(admin, { type: 'bearer' })
      .send({ title: 'Only two', body: 'Hello.', audience: { kind: 'STUDENTS', studentIds: ['20260002'] } });
    expect((await request(app).post(`/api/v1/students/me/messages/${body.message.id}/read`).auth(one, { type: 'bearer' })).body).toEqual({ marked: 0 });
    expect((await request(app).get('/api/v1/students/me/messages/unread-count').auth(two, { type: 'bearer' })).body).toEqual({ unread: 1 });
  });

  it('targets explicit IDs and reports unknown ones, refusing an empty audience', async () => {
    const { app, admin } = await setup();
    const sent = await request(app).post('/api/v1/admin/messages').auth(admin, { type: 'bearer' })
      .send({ title: 'Hi', body: 'Hello.', audience: { kind: 'STUDENTS', studentIds: ['20260001', '29999999', '20260001'] } });
    expect(sent.body).toMatchObject({ message: { recipientCount: 1 }, unknownIds: ['29999999'] });
    const none = await request(app).post('/api/v1/admin/messages').auth(admin, { type: 'bearer' })
      .send({ title: 'Hi', body: 'Hello.', audience: { kind: 'YEAR_GROUP', yearGroup: 2031 } });
    expect(none.status).toBe(422);
    expect(none.body.error).toBe('NO_RECIPIENTS');
  });

  it('targets students by standing', async () => {
    const { app, admin, store } = await setup();
    Object.assign(store.students[0], { synthetic: true });
    const preview = await request(app).post('/api/v1/admin/messages/preview').auth(admin, { type: 'bearer' }).send({ audience: { kind: 'STANDING', standing: 'RED' } });
    expect(preview.body.recipientCount).toBeLessThanOrEqual(1);
  });

  it('validates input and offers templates', async () => {
    const { app, admin } = await setup();
    for (const body of [{ title: '', body: 'x', audience: { kind: 'ALL_STUDENTS' } }, { title: 'x', body: 'x', audience: { kind: 'EVERYONE' } }, { title: 'x', body: 'x'.repeat(5001), audience: { kind: 'ALL_STUDENTS' } }]) {
      expect((await request(app).post('/api/v1/admin/messages').auth(admin, { type: 'bearer' }).send(body)).status).toBe(400);
    }
    const templates = await request(app).get('/api/v1/admin/messages/templates').auth(admin, { type: 'bearer' });
    expect(templates.body.templates.map((t: { id: string }) => t.id)).toContain('retake-reminder');
  });

  it('keeps students away from sending and admins away from inboxes', async () => {
    const { app, admin, one } = await setup();
    expect((await request(app).post('/api/v1/admin/messages').auth(one, { type: 'bearer' }).send({ title: 'x', body: 'x', audience: { kind: 'ALL_STUDENTS' } })).status).toBe(403);
    expect((await request(app).get('/api/v1/students/me/messages').auth(admin, { type: 'bearer' })).status).toBe(403);
    expect((await request(app).get('/api/v1/students/me/messages')).status).toBe(401);
  });
});

describe('scheduled messages', () => {
  it('delivers at the scheduled time, shows as scheduled until then, and can be cancelled only before', async () => {
    let clock = new Date('2026-11-17T09:00:00Z');
    const built = await buildTestApp({}, () => clock);
    const admin = await login(built.app, 'STF-1001', ADMIN_PASSWORD);
    const one = await login(built.app, '20260001', STUDENT_PASSWORD);
    const send = (sendAt: string, title = 'Audit week') => request(built.app).post('/api/v1/admin/messages').auth(admin, { type: 'bearer' })
      .send({ title, body: 'Your audit review is next week.', audience: { kind: 'STUDENTS', studentIds: ['20260001'] }, sendAt });
    const inbox = async () => (await request(built.app).get('/api/v1/students/me/messages').auth(one, { type: 'bearer' })).body;

    for (const sendAt of ['2026-11-17T09:00:30Z', '2026-11-16T09:00:00Z', '2027-06-01T00:00:00Z', 'tomorrow']) {
      expect((await send(sendAt)).status).toBe(400);
    }
    const scheduled = await send('2026-11-18T08:00:00+00:00');
    expect(scheduled.status).toBe(201);
    expect(built.store.auditLog.find(entry => entry.action === 'ADMIN_MESSAGE_SENT')?.metadata).toMatchObject({ scheduledFor: '2026-11-18T08:00:00.000Z' });
    expect(await inbox()).toEqual({ messages: [], unread: 0 });
    const listed = (await request(built.app).get('/api/v1/admin/messages').auth(admin, { type: 'bearer' })).body.messages;
    expect(listed[0]).toMatchObject({ title: 'Audit week', scheduled: true, sentAt: '2026-11-18T08:00:00.000Z' });

    clock = new Date('2026-11-18T08:00:01Z');
    expect((await inbox()).unread).toBe(1);
    expect((await request(built.app).delete(`/api/v1/admin/messages/${scheduled.body.message.id}`).auth(admin, { type: 'bearer' })).status).toBe(409);

    const later = await send('2026-11-25T08:00:00Z', 'Cancelled reminder');
    expect((await request(built.app).delete(`/api/v1/admin/messages/${later.body.message.id}`).auth(admin, { type: 'bearer' })).status).toBe(204);
    clock = new Date('2026-11-26T00:00:00Z');
    expect((await inbox()).messages.map((message: { title: string }) => message.title)).toEqual(['Audit week']);
    expect(built.store.auditLog.filter(entry => entry.action === 'ADMIN_MESSAGE_CANCELLED')).toHaveLength(1);
  });
});
