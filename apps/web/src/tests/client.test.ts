import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { dataSchemas } from '@pawlog/shared';
import { apiRequest } from '../services/client';
const { getSession, signOut } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn().mockResolvedValue({ error: null }),
}));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession, signOut } } }));
const request = vi.fn();
beforeEach(() => {
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('fetch', request);
  request.mockReset();
  getSession.mockResolvedValue({ data: { session: { access_token: 'test-token' } }, error: null });
});
afterEach(() => vi.unstubAllGlobals());
describe('authenticated API client', () => {
  it('uses the verified session and preserves request key and payload on retries', async () => {
    request.mockRejectedValueOnce(new TypeError('lost connection')).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: '00000000-0000-4000-8000-000000000001' } }), {
        status: 201,
      }),
    );
    const options = { method: 'POST', body: { notes: 'Dinner' }, idempotencyKey: 'stable-key' };
    await expect(apiRequest('/test', dataSchemas.created, options)).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
    await apiRequest('/test', dataSchemas.created, options);
    expect(request.mock.calls[0]?.[1].body).toEqual(request.mock.calls[1]?.[1].body);
    expect(request.mock.calls[0]?.[1].headers).toEqual(request.mock.calls[1]?.[1].headers);
    expect(request.mock.calls[1]?.[1].headers.Authorization).toBe('Bearer test-token');
  });
  it('rejects offline submissions without attempting a session or network request', async () => {
    getSession.mockClear();
    vi.stubGlobal('navigator', { onLine: false });
    await expect(apiRequest('/me', dataSchemas.account)).rejects.toMatchObject({ code: 'OFFLINE' });
    expect(getSession).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
  it('preserves structured recent-feeding conflicts', async () => {
    request.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'RECENT_FEEDING',
            message: 'Recently fed',
            details: { warning_minutes: 15 },
          },
        }),
        { status: 409 },
      ),
    );
    await expect(
      apiRequest('/test', dataSchemas.created, { method: 'POST' }),
    ).rejects.toMatchObject({
      code: 'RECENT_FEEDING',
      status: 409,
      details: { warning_minutes: 15 },
    });
  });
  it('does not treat malformed successful responses as a saved activity', async () => {
    request.mockResolvedValue(
      new Response(JSON.stringify({ data: { unexpected: true } }), { status: 200 }),
    );
    await expect(apiRequest('/test', dataSchemas.savedActivity)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
  it('requires a session before a protected request', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(apiRequest('/me', dataSchemas.account)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(request).not.toHaveBeenCalled();
  });
  it('preserves query cancellation rather than displaying it as a network error', async () => {
    const controller = new AbortController();
    controller.abort();
    const error = new DOMException('Aborted', 'AbortError');
    request.mockRejectedValue(error);
    await expect(
      apiRequest('/me', dataSchemas.account, { signal: controller.signal }),
    ).rejects.toBe(error);
  });
});

it('clears an invalid session after an API 401 instead of looping back into the app', async () => {
  request.mockResolvedValue(
    new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Please sign in again.' } }),
      { status: 401 },
    ),
  );
  await expect(apiRequest('/me', dataSchemas.account)).rejects.toMatchObject({ status: 401 });
  expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
});

it('asks users to refresh before retrying an unconfirmed non-idempotent creation', async () => {
  request.mockRejectedValue(new TypeError('Connection lost'));
  await expect(
    apiRequest('/households', dataSchemas.created, { method: 'POST', body: { name: 'Home' } }),
  ).rejects.toMatchObject({ code: 'NETWORK_ERROR', message: expect.stringContaining('Refresh') });
});

it('times out dashboard reads even when a query cancellation signal is provided', async () => {
  const deadline = new AbortController();
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
  const query = new AbortController();
  request.mockImplementation(
    (_path, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), {
          once: true,
        });
      }),
  );
  const result = apiRequest('/me', dataSchemas.account, { signal: query.signal });
  await Promise.resolve();
  const rejected = expect(result).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  deadline.abort(new DOMException('Timed out', 'TimeoutError'));
  await rejected;
  expect(query.signal.aborted).toBe(false);
  timeout.mockRestore();
});
