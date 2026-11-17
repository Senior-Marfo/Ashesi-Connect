import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './api';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const tokens = (accessToken: string) => json(200, { accessToken, role: 'STUDENT', passwordChangeRequired: false });

function header(call: unknown[], name: string): string | null {
  return new Headers((call[1] as RequestInit).headers).get(name);
}

describe('api client', () => {
  it('sends credentials and the anti-CSRF header, and keeps the access token in memory', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(tokens('first')).mockResolvedValueOnce(json(200, { student: {}, courses: [] }));
    const api = createApiClient('https://api.test', fetchMock);
    await expect(api.login('20280001', 'secret')).resolves.toEqual({ role: 'STUDENT', passwordChangeRequired: false });
    await api.myRecord();
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
    expect(header(fetchMock.mock.calls[0], 'x-requested-with')).toBe('fetch');
    expect(header(fetchMock.mock.calls[1], 'authorization')).toBe('Bearer first');
  });

  it('refreshes once on 401 and retries the request with the new token', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokens('stale'))
      .mockResolvedValueOnce(json(401, { error: 'UNAUTHORIZED' }))
      .mockResolvedValueOnce(tokens('fresh'))
      .mockResolvedValueOnce(json(200, { student: { studentId: '20280001' }, courses: [] }));
    const api = createApiClient('https://api.test', fetchMock);
    await api.login('20280001', 'secret');
    await expect(api.myRecord()).resolves.toMatchObject({ student: { studentId: '20280001' } });
    expect(fetchMock.mock.calls[2][0]).toBe('https://api.test/api/v1/auth/refresh');
    expect(header(fetchMock.mock.calls[3], 'authorization')).toBe('Bearer fresh');
  });

  it('shares one refresh between concurrent requests, because refresh tokens are single-use', async () => {
    let refreshes = 0;
    let current = 'stale';
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith('/auth/login')) return tokens('stale');
      if (String(url).endsWith('/auth/refresh')) {
        refreshes += 1;
        current = 'fresh';
        return tokens('fresh');
      }
      return new Headers(init?.headers).get('authorization') === `Bearer ${current}` && current === 'fresh'
        ? json(200, { students: [] })
        : json(401, { error: 'UNAUTHORIZED' });
    });
    const api = createApiClient('https://api.test', fetchMock);
    await api.login('STF-1001', 'secret');
    await Promise.all([api.searchStudents('1'), api.searchStudents('2'), api.searchStudents('3')]);
    expect(refreshes).toBe(1);
  });

  it('surfaces API error codes and messages', async () => {
    const api = createApiClient('https://api.test', vi.fn().mockResolvedValue(json(422, { error: 'WEAK_PASSWORD', message: 'Too short' })));
    await expect(api.changePassword('a', 'b')).rejects.toEqual(new ApiError(422, 'WEAK_PASSWORD', 'Too short'));
  });

  it('forgets the access token when refresh fails and after logout', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokens('first'))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json(401, { error: 'UNAUTHORIZED' }));
    const api = createApiClient('https://api.test', fetchMock);
    await api.login('20280001', 'secret');
    await api.logout();
    await expect(api.myRecord()).rejects.toMatchObject({ status: 401 });
    expect(header(fetchMock.mock.calls[2], 'authorization')).toBeNull();
  });

  it('encodes search terms and student IDs into the URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { students: [] }));
    const api = createApiClient('https://api.test', fetchMock);
    await api.searchStudents('a b&c');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/api/v1/admin/students?q=a%20b%26c');
  });
});
