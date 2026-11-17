#!/usr/bin/env node
/**
 * Post-deploy smoke test for a running Graduation Tracker (read-only apart from sign-in records).
 *
 *   SMOKE_BASE_URL            e.g. https://ashesi-graduation-tracker.onrender.com
 *   SMOKE_ADMIN_ID / SMOKE_ADMIN_PASSWORD        optional; enables the admin checks
 *   SMOKE_STUDENT_ID / SMOKE_STUDENT_PASSWORD    optional; enables the student checks
 *
 * Uses the already-seeded accounts and signs in to each at most once per run, so a wrong
 * password cannot lock an account. Accounts must not need a password change. Prints a
 * Markdown table (never IDs, passwords or tokens) and exits 1 if any check fails.
 */
const base = (process.env.SMOKE_BASE_URL ?? '').replace(/\/+$/, '');
if (!/^https?:\/\/[\w.-]+(:\d+)?$/.test(base)) {
  console.error('Set SMOKE_BASE_URL to the service origin, without a path.');
  process.exit(2);
}

const results = [];
async function check(name, run) {
  const started = Date.now();
  try {
    const detail = await run();
    results.push({ name, ok: true, detail: detail ?? '', ms: Date.now() - started });
  } catch (error) {
    results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error), ms: Date.now() - started });
  }
}

async function call(path, { token, method = 'GET', body, csrf = false, cookie } = {}) {
  const headers = { accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body) headers['content-type'] = 'application/json';
  if (csrf) headers['x-requested-with'] = 'smoke-test';
  if (cookie) headers.cookie = cookie;
  // Render's free tier sleeps; the first request can take close to a minute.
  return fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual', signal: AbortSignal.timeout(90_000) });
}

function expectStatus(response, expected) {
  if (response.status !== expected) throw new Error(`expected HTTP ${expected}, got ${response.status}`);
}

async function signIn(role, identifier, password) {
  const response = await call('/api/v1/auth/login', { method: 'POST', body: { identifier, password } });
  expectStatus(response, 200);
  const body = await response.json();
  if (body.role !== role) throw new Error(`signed in with role ${body.role}, expected ${role}`);
  if (body.passwordChangeRequired) throw new Error('account still has a temporary password; change it first');
  const cookie = (response.headers.getSetCookie?.() ?? []).map(value => value.split(';')[0]).join('; ');
  return { token: body.accessToken, cookie };
}

async function signOut(session) {
  const response = await call('/api/v1/auth/logout', { method: 'POST', csrf: true, cookie: session.cookie });
  expectStatus(response, 204);
}

await check('Health endpoint', async () => {
  const response = await call('/health');
  expectStatus(response, 200);
  const body = await response.json();
  if (body.status !== 'ok') throw new Error(`status is ${JSON.stringify(body.status)}`);
  return 'status ok';
});

await check('Web client served', async () => {
  for (const path of ['/', '/student/', '/admin/', '/demo/']) {
    const response = await call(path);
    expectStatus(response, 200);
    if (!(response.headers.get('content-type') ?? '').includes('text/html')) throw new Error(`${path} is not HTML`);
  }
  return '/, /student/, /admin/, /demo/';
});

await check('Security headers', async () => {
  const response = await call('/');
  const missing = ['content-security-policy', 'strict-transport-security', 'x-content-type-options', 'referrer-policy'].filter(name => !response.headers.has(name));
  if (missing.length) throw new Error(`missing ${missing.join(', ')}`);
  return 'CSP, HSTS, nosniff, referrer policy';
});

await check('Anonymous admin request refused', async () => {
  expectStatus(await call('/api/v1/admin/students?q=1'), 401);
  return '401';
});

await check('Wrong password refused generically', async () => {
  const response = await call('/api/v1/auth/login', { method: 'POST', body: { identifier: 'SMOKE-NO-SUCH-ACCOUNT', password: 'Not-The-Password-1' } });
  expectStatus(response, 401);
  return '401';
});

const { SMOKE_ADMIN_ID, SMOKE_ADMIN_PASSWORD, SMOKE_STUDENT_ID, SMOKE_STUDENT_PASSWORD } = process.env;

if (SMOKE_STUDENT_ID && SMOKE_STUDENT_PASSWORD) {
  let student;
  await check('Student sign-in', async () => { student = await signIn('STUDENT', SMOKE_STUDENT_ID, SMOKE_STUDENT_PASSWORD); return 'role STUDENT'; });
  if (student) {
    await check('Student record', async () => {
      const response = await call('/api/v1/students/me', { token: student.token });
      expectStatus(response, 200);
      const body = await response.json();
      return `${body.courses.length} courses on record`;
    });
    await check('Student graduation status', async () => {
      const response = await call('/api/v1/students/me/eligibility', { token: student.token });
      expectStatus(response, 200);
      const body = await response.json();
      return `status ${body.status}, standing ${body.standing?.level ?? 'none'}`;
    });
    await check('Student cannot reach admin routes', async () => {
      expectStatus(await call('/api/v1/admin/students?q=1', { token: student.token }), 403);
      return '403';
    });
    await check('Student sign-out', async () => { await signOut(student); return '204'; });
  }
}

if (SMOKE_ADMIN_ID && SMOKE_ADMIN_PASSWORD) {
  let admin;
  await check('Admin sign-in', async () => { admin = await signIn('ADMIN', SMOKE_ADMIN_ID, SMOKE_ADMIN_PASSWORD); return 'role ADMIN'; });
  if (admin) {
    await check('Admin student search', async () => {
      const response = await call('/api/v1/admin/students?q=20', { token: admin.token });
      expectStatus(response, 200);
      return `${(await response.json()).students.length} results for "20"`;
    });
    await check('Register', async () => {
      const response = await call('/api/v1/admin/register?pageSize=10', { token: admin.token });
      expectStatus(response, 200);
      const body = await response.json();
      return `${body.total} students; RED ${body.counts?.RED ?? 0}, YELLOW ${body.counts?.YELLOW ?? 0}, GREEN ${body.counts?.GREEN ?? 0}`;
    });
    await check('Report generation', async () => {
      const response = await call('/api/v1/admin/reports', { token: admin.token });
      expectStatus(response, 200);
      const body = await response.json();
      return `sections: ${Object.keys(body).join(', ')}`;
    });
    await check('Admin sign-out', async () => { await signOut(admin); return '204'; });
  }
}

const skipped = [!(SMOKE_STUDENT_ID && SMOKE_STUDENT_PASSWORD) && 'student checks', !(SMOKE_ADMIN_ID && SMOKE_ADMIN_PASSWORD) && 'admin checks'].filter(Boolean);
const lines = [
  `Smoke test of ${base} at ${new Date().toISOString()}`,
  '',
  '| Check | Result | Detail | Time |',
  '|---|---|---|---|',
  ...results.map(result => `| ${result.name} | ${result.ok ? 'Pass' : '**Fail**'} | ${result.detail.replace(/\|/g, '\\|')} | ${result.ms} ms |`),
  ...(skipped.length ? ['', `Skipped (no credentials provided): ${skipped.join(', ')}.`] : [])
];
console.log(lines.join('\n'));
process.exit(results.every(result => result.ok) ? 0 : 1);
