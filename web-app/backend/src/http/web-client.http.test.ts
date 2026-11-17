import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from '../testing/fixtures.js';

let staticDir: string;

beforeAll(() => {
  staticDir = mkdtempSync(join(tmpdir(), 'web-client-'));
  mkdirSync(join(staticDir, 'student'));
  mkdirSync(join(staticDir, '_next', 'static', 'chunks'), { recursive: true });
  writeFileSync(join(staticDir, 'index.html'), '<h1>sign in</h1>');
  writeFileSync(join(staticDir, 'student', 'index.html'), '<h1>student</h1>');
  writeFileSync(join(staticDir, '404.html'), '<h1>not found</h1>');
  writeFileSync(join(staticDir, '_next', 'static', 'chunks', 'app.js'), 'console.log(1)');
});

describe('web client served from the API origin', () => {
  it('serves pages, redirecting to the trailing-slash form', async () => {
    const { app } = await buildTestApp({ STATIC_DIR: staticDir });
    expect((await request(app).get('/')).text).toContain('sign in');
    const redirect = await request(app).get('/student');
    expect(redirect.status).toBe(301);
    expect(redirect.headers.location).toBe('/student/');
    const page = await request(app).get('/student/');
    expect(page.text).toContain('student');
    expect(page.headers['cache-control']).toBe('no-cache');
  });

  it('caches hashed build assets for a year', async () => {
    const { app } = await buildTestApp({ STATIC_DIR: staticDir });
    const asset = await request(app).get('/_next/static/chunks/app.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('returns the HTML 404 page for unknown pages but JSON for unknown API routes', async () => {
    const { app } = await buildTestApp({ STATIC_DIR: staticDir });
    const page = await request(app).get('/nowhere/');
    expect(page.status).toBe(404);
    expect(page.text).toContain('not found');
    const api = await request(app).get('/api/v1/nowhere');
    expect(api.status).toBe(404);
    expect(api.body).toEqual({ error: 'NOT_FOUND' });
  });

  it('sends a restrictive content security policy', async () => {
    const { app } = await buildTestApp({ STATIC_DIR: staticDir });
    const csp = (await request(app).get('/')).headers['content-security-policy'];
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it('serves nothing from disk when no static directory is configured', async () => {
    const { app } = await buildTestApp();
    expect((await request(app).get('/')).status).toBe(404);
  });
});
