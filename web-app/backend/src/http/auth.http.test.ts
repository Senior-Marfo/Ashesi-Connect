import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ADMIN_PASSWORD, STUDENT_PASSWORD, buildTestApp } from '../testing/fixtures.js';
import { REFRESH_COOKIE } from './auth-routes.js';

type App = Awaited<ReturnType<typeof buildTestApp>>['app'];

function refreshCookieFrom(response: request.Response): string {
  const cookies = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
  const cookie = cookies.find(value => value.startsWith(`${REFRESH_COOKIE}=`));
  if (!cookie) throw new Error('refresh cookie not set');
  return cookie.split(';')[0];
}

async function login(app: App, identifier: string, password: string) {
  return request(app).post('/api/v1/auth/login').send({ identifier, password });
}

describe('login', () => {
  it('resolves the role from the stored account and ignores any client-supplied role', async () => {
    const { app } = await buildTestApp();
    const response = await request(app).post('/api/v1/auth/login').send({ identifier: '20260001', password: STUDENT_PASSWORD, role: 'ADMIN' });
    expect(response.status).toBe(200);
    expect(response.body.role).toBe('STUDENT');
    expect(response.body.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(response.body).not.toHaveProperty('refreshToken');
  });

  it('trims surrounding whitespace but otherwise matches the stored ID exactly', async () => {
    const { app } = await buildTestApp();
    const trimmed = await login(app, '  STF-1001 ', ADMIN_PASSWORD);
    expect(trimmed.status).toBe(200);
    expect(trimmed.body.role).toBe('ADMIN');
    expect((await login(app, 'stf-1001', ADMIN_PASSWORD)).status).toBe(401);
  });

  it('honours configured ID patterns for deployments with other ID formats', async () => {
    const { app, store } = await buildTestApp({ STAFF_ID_REGEX: '^demo\\.admin$' });
    store.users.push({ ...store.users[2], id: 'u-demo-admin', identifier: 'demo.admin' });
    expect((await login(app, 'demo.admin', ADMIN_PASSWORD)).status).toBe(200);
    expect((await login(app, 'STF-1001', ADMIN_PASSWORD)).status).toBe(401);
  });

  it('sets the refresh token only as an httpOnly cookie scoped to the auth path', async () => {
    const { app } = await buildTestApp();
    const response = await login(app, '20260001', STUDENT_PASSWORD);
    const cookie = ([] as string[]).concat(response.headers['set-cookie']).find(value => value.startsWith(REFRESH_COOKIE));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).not.toMatch(/Secure/);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('marks the cookie Secure and first-party in production', async () => {
    const { app } = await buildTestApp({ NODE_ENV: 'production', MONGODB_URI: 'mongodb://unused' });
    const response = await login(app, '20260001', STUDENT_PASSWORD);
    const cookie = ([] as string[]).concat(response.headers['set-cookie']).find(value => value.startsWith(REFRESH_COOKIE));
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
  });

  it('returns the same error for unknown IDs, malformed IDs and wrong passwords', async () => {
    const { app } = await buildTestApp();
    const responses = await Promise.all([
      login(app, '20269999', STUDENT_PASSWORD),
      login(app, 'not-an-id', STUDENT_PASSWORD),
      login(app, '20260001', 'wrong-password')
    ]);
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'INVALID_CREDENTIALS' });
    }
  });

  it('locks the account after repeated failures, even with the right password afterwards', async () => {
    const { app, store } = await buildTestApp({ LOCKOUT_THRESHOLD: '3' });
    for (let attempt = 0; attempt < 3; attempt += 1) await login(app, '20260001', 'wrong-password');
    expect(store.users.find(user => user.identifier === '20260001')?.lockedUntil).toBeInstanceOf(Date);
    const response = await login(app, '20260001', STUDENT_PASSWORD);
    expect(response.status).toBe(401);
    expect(store.auditLog.some(entry => entry.action === 'AUTH_ACCOUNT_LOCKED' && entry.subject === '20260001')).toBe(true);
  });

  it('rate limits repeated attempts against one ID from one address', async () => {
    const { app } = await buildTestApp({ LOGIN_RATE_LIMIT_MAX: '2', LOCKOUT_THRESHOLD: '50' });
    await login(app, '20260001', 'wrong-password');
    await login(app, '20260001', 'wrong-password');
    const limited = await login(app, '20260001', STUDENT_PASSWORD);
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: 'TOO_MANY_ATTEMPTS' });
    expect((await login(app, '20260002', STUDENT_PASSWORD)).status).toBe(200);
  });

  it('rejects malformed bodies', async () => {
    const { app } = await buildTestApp();
    expect((await request(app).post('/api/v1/auth/login').send({ identifier: 'x' })).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/login').set('content-type', 'application/json').send('{bad')).status).toBe(400);
  });
});

describe('refresh token rotation', () => {
  it('issues a new access token and rotates the cookie', async () => {
    const { app } = await buildTestApp();
    const first = refreshCookieFrom(await login(app, '20260001', STUDENT_PASSWORD));
    const refreshed = await request(app).post('/api/v1/auth/refresh').set('cookie', first).set('x-requested-with', 'fetch');
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.role).toBe('STUDENT');
    expect(refreshCookieFrom(refreshed)).not.toBe(first);
  });

  it('requires the anti-CSRF header', async () => {
    const { app } = await buildTestApp();
    const cookie = refreshCookieFrom(await login(app, '20260001', STUDENT_PASSWORD));
    const response = await request(app).post('/api/v1/auth/refresh').set('cookie', cookie);
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('CSRF_HEADER_MISSING');
  });

  it('revokes the whole family when a rotated token is replayed', async () => {
    const { app, store } = await buildTestApp();
    const original = refreshCookieFrom(await login(app, '20260001', STUDENT_PASSWORD));
    const rotated = refreshCookieFrom(await request(app).post('/api/v1/auth/refresh').set('cookie', original).set('x-requested-with', 'fetch'));

    const replay = await request(app).post('/api/v1/auth/refresh').set('cookie', original).set('x-requested-with', 'fetch');
    expect(replay.status).toBe(401);

    const legitimate = await request(app).post('/api/v1/auth/refresh').set('cookie', rotated).set('x-requested-with', 'fetch');
    expect(legitimate.status).toBe(401);
    expect(store.auditLog.some(entry => entry.action === 'AUTH_REFRESH_REUSE_DETECTED')).toBe(true);
  });

  it('stores only hashes of refresh tokens', async () => {
    const { app, store } = await buildTestApp();
    const cookie = refreshCookieFrom(await login(app, '20260001', STUDENT_PASSWORD));
    const raw = decodeURIComponent(cookie.split('=')[1]);
    expect(store.refreshTokens.some(record => record.tokenHash === raw)).toBe(false);
    expect(store.refreshTokens[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('logout revokes the session and clears the cookie', async () => {
    const { app } = await buildTestApp();
    const cookie = refreshCookieFrom(await login(app, '20260001', STUDENT_PASSWORD));
    const logout = await request(app).post('/api/v1/auth/logout').set('cookie', cookie).set('x-requested-with', 'fetch');
    expect(logout.status).toBe(204);
    expect(String(logout.headers['set-cookie'])).toMatch(new RegExp(`${REFRESH_COOKIE}=;`));
    const after = await request(app).post('/api/v1/auth/refresh').set('cookie', cookie).set('x-requested-with', 'fetch');
    expect(after.status).toBe(401);
  });
});

describe('password change and admin reset', () => {
  it('admin reset forces a password change before any other route can be used', async () => {
    const { app, store } = await buildTestApp();
    const adminToken = (await login(app, 'STF-1001', ADMIN_PASSWORD)).body.accessToken;
    const studentCookie = refreshCookieFrom(await login(app, '20260001', STUDENT_PASSWORD));

    const reset = await request(app).post('/api/v1/admin/users/reset-password').auth(adminToken, { type: 'bearer' }).send({ identifier: '20260001' });
    expect(reset.status).toBe(200);
    const temporaryPassword: string = reset.body.temporaryPassword;
    expect(store.auditLog.some(entry => entry.action === 'ADMIN_PASSWORD_RESET' && entry.actorId === 'u-admin-1' && entry.subject === '20260001')).toBe(true);

    const oldSession = await request(app).post('/api/v1/auth/refresh').set('cookie', studentCookie).set('x-requested-with', 'fetch');
    expect(oldSession.status).toBe(401);
    expect((await login(app, '20260001', STUDENT_PASSWORD)).status).toBe(401);

    const temporary = await login(app, '20260001', temporaryPassword);
    expect(temporary.body.passwordChangeRequired).toBe(true);
    const blocked = await request(app).get('/api/v1/students/me').auth(temporary.body.accessToken, { type: 'bearer' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe('PASSWORD_CHANGE_REQUIRED');

    const changed = await request(app).post('/api/v1/auth/password').auth(temporary.body.accessToken, { type: 'bearer' })
      .send({ currentPassword: temporaryPassword, newPassword: 'Fresh-Start-2028!' });
    expect(changed.status).toBe(200);
    expect(changed.body.passwordChangeRequired).toBe(false);
    const allowed = await request(app).get('/api/v1/students/me').auth(changed.body.accessToken, { type: 'bearer' });
    expect(allowed.status).toBe(200);
  });

  it('rejects weak passwords and passwords containing the ID', async () => {
    const { app } = await buildTestApp();
    const token = (await login(app, '20260001', STUDENT_PASSWORD)).body.accessToken;
    for (const newPassword of ['short', 'alllowercaseletters', 'Mine-20260001-Pass']) {
      const response = await request(app).post('/api/v1/auth/password').auth(token, { type: 'bearer' }).send({ currentPassword: STUDENT_PASSWORD, newPassword });
      expect(response.status).toBe(422);
      expect(response.body.error).toBe('WEAK_PASSWORD');
    }
  });

  it('requires the current password', async () => {
    const { app } = await buildTestApp();
    const token = (await login(app, '20260001', STUDENT_PASSWORD)).body.accessToken;
    const response = await request(app).post('/api/v1/auth/password').auth(token, { type: 'bearer' }).send({ currentPassword: 'guess', newPassword: 'Fresh-Start-2028!' });
    expect(response.status).toBe(401);
  });
});
