import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';
const source = readFileSync(new URL('../../service-worker/sw.js', import.meta.url), 'utf8').replace(
  'self.__WB_MANIFEST',
  JSON.stringify([
    { url: 'index.html', revision: 'test' },
    { url: 'assets/app.js', revision: null },
  ]),
);
function worker() {
  const listeners: Record<string, (event: unknown) => void> = {};
  const cache = {
    addAll: vi.fn().mockResolvedValue(undefined),
    match: vi.fn().mockResolvedValue('shell'),
  };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue(['pawlog-shell-old', 'another-app']),
    delete: vi.fn().mockResolvedValue(true),
  };
  const fetch = vi.fn().mockResolvedValue('network');
  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      listeners[type] = fn;
    },
    location: { origin: 'https://pawlog.test' },
    clients: { claim: vi.fn() },
    skipWaiting: vi.fn(),
  };
  vm.runInNewContext(source, { self, caches, fetch, URL, Response });
  function request(url: string, method = 'GET', mode = 'cors') {
    const respondWith = vi.fn();
    listeners.fetch!({ request: { url, method, mode }, respondWith });
    return respondWith;
  }
  return { listeners, request, caches, cache, fetch, self };
}
it('never intercepts API, Supabase, photos or writes', () => {
  const w = worker();
  for (const [url, method, mode] of [
    ['https://pawlog.test/api/me', 'GET', 'navigate'],
    ['https://pawlog.test/api', 'GET', 'navigate'],
    ['https://project.supabase.co/auth/v1/user', 'GET', 'cors'],
    ['https://photos.test/pet.png', 'GET', 'cors'],
    ['https://pawlog.test/api/logs', 'POST', 'cors'],
    ['https://pawlog.test/unlisted-photo.png', 'GET', 'cors'],
  ])
    expect(w.request(url!, method!, mode!)).not.toHaveBeenCalled();
});
it('uses network navigation and falls back to only the shell offline', async () => {
  const w = worker();
  expect(await w.request('https://pawlog.test/app', 'GET', 'navigate').mock.calls[0]![0]).toBe(
    'network',
  );
  expect(w.cache.match).not.toHaveBeenCalled();
  w.fetch.mockRejectedValueOnce(new Error('offline'));
  expect(
    await w.request('https://pawlog.test/app/settings', 'GET', 'navigate').mock.calls[0]![0],
  ).toBe('shell');
  expect(w.cache.match).toHaveBeenCalledWith('/index.html');
});
it('caches explicit files, cleans only its old releases and waits for update consent', async () => {
  const w = worker();
  const waitUntil = vi.fn();
  w.listeners.install!({ waitUntil });
  await waitUntil.mock.calls[0]![0];
  expect(w.cache.addAll).toHaveBeenCalledWith(['/index.html', '/assets/app.js']);
  expect(w.self.skipWaiting).not.toHaveBeenCalled();
  w.listeners.activate!({ waitUntil });
  await waitUntil.mock.calls[1]![0];
  expect(w.caches.delete).toHaveBeenCalledExactlyOnceWith('pawlog-shell-old');
  w.listeners.message!({ data: { type: 'SKIP_WAITING' } });
  expect(w.self.skipWaiting).toHaveBeenCalledOnce();
});
