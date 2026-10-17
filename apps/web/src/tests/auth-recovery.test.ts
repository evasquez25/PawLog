// @vitest-environment jsdom
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
const mock = vi.hoisted(() => ({
  callback: null as null | ((event: AuthChangeEvent, session: Session | null) => void),
  unsubscribe: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (callback: typeof mock.callback) => {
        mock.callback = callback;
        return { data: { subscription: { unsubscribe: mock.unsubscribe } } };
      },
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));
afterEach(() => cleanup());
function Probe() {
  const auth = useAuth();
  return createElement(
    'button',
    { onClick: auth.finishRecovery },
    auth.loading ? 'loading' : auth.recovering ? 'recovery' : 'normal',
  );
}
it('preserves recovery routing through user updates until the password form finishes', async () => {
  const cache = new QueryClient();
  render(
    createElement(
      QueryClientProvider,
      { client: cache },
      createElement(AuthProvider, null, createElement(Probe)),
    ),
  );
  await screen.findByRole('button', { name: 'normal' });
  const session = { user: { id: 'fixture-user' } } as Session;
  act(() => mock.callback!('PASSWORD_RECOVERY', session));
  expect(screen.getByRole('button', { name: 'recovery' })).toBeTruthy();
  act(() => mock.callback!('USER_UPDATED', session));
  expect(screen.getByRole('button', { name: 'recovery' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'normal' })).toBeTruthy());
  cache.clear();
});
