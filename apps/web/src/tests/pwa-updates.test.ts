// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PwaUpdates } from '@/components/PwaUpdates';
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('waits for consent and refreshes the waiting worker before applying an update', async () => {
  vi.stubEnv('PROD', true);
  const oldWorker = { postMessage: vi.fn() };
  const currentWorker = { postMessage: vi.fn(), addEventListener: vi.fn() };
  const registration = {
    waiting: oldWorker,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    update: vi.fn(),
  };
  const serviceWorker = {
    controller: {},
    register: vi.fn().mockResolvedValue(registration),
    getRegistration: vi.fn().mockResolvedValue({ waiting: currentWorker }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('navigator', { serviceWorker, onLine: true });
  render(createElement(PwaUpdates));
  const button = await screen.findByRole('button', { name: 'Update now' });
  expect(currentWorker.postMessage).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(() =>
    expect(currentWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' }),
  );
  expect(oldWorker.postMessage).not.toHaveBeenCalled();
});
it('does not present first installation as an app update', async () => {
  vi.stubEnv('PROD', true);
  const register = vi
    .fn()
    .mockResolvedValue({ waiting: {}, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('navigator', {
    serviceWorker: {
      controller: null,
      register,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  render(createElement(PwaUpdates));
  await waitFor(() => expect(register).toHaveBeenCalledOnce());
  expect(screen.queryByRole('button', { name: 'Update now' })).toBeNull();
});
