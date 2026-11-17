import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const base = { JWT_ACCESS_SECRET: 'x'.repeat(32) };

describe('loadConfig', () => {
  it('treats blank variables as unset', () => {
    const config = loadConfig({ ...base, REFRESH_COOKIE_SAMESITE: '', SEED_ADMIN_STAFF_ID: '', SEED_ADMIN_PASSWORD: '', STATIC_DIR: '' });
    expect(config.refreshCookie.sameSite).toBe('strict');
    expect(config.bootstrapAdmin).toBeUndefined();
    expect(config.staticDir).toBeUndefined();
  });

  it('uses secure first-party cookies and one trusted proxy hop in production', () => {
    const config = loadConfig({ ...base, NODE_ENV: 'production', MONGODB_URI: 'mongodb://db/app' });
    expect(config.refreshCookie).toEqual({ secure: true, sameSite: 'strict' });
    expect(config.trustProxyHops).toBe(1);
  });

  it('refuses to start in production without a database or with a short secret', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow('MONGODB_URI');
    expect(() => loadConfig({ JWT_ACCESS_SECRET: 'short' })).toThrow('at least 32');
  });
});
