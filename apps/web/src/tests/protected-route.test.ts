// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
const state = vi.hoisted(() => ({
  loading: true,
  session: null as null | { user: { id: string } },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => state }));
afterEach(() => cleanup());
function mount() {
  render(
    createElement(
      MemoryRouter,
      { initialEntries: ['/app'] },
      createElement(
        Routes,
        null,
        createElement(
          Route,
          { element: createElement(ProtectedRoute) },
          createElement(Route, {
            path: '/app',
            element: createElement('h1', null, 'Private household'),
          }),
        ),
        createElement(Route, { path: '/login', element: createElement('h1', null, 'Sign in') }),
      ),
    ),
  );
}
it('waits for session restoration before showing private content or redirecting', () => {
  state.loading = true;
  state.session = null;
  mount();
  expect(screen.getByRole('status').textContent).toContain('Getting');
  expect(screen.queryByRole('heading')).toBeNull();
});
it('redirects signed-out users to sign-in', () => {
  state.loading = false;
  state.session = null;
  mount();
  expect(screen.getByRole('heading').textContent).toBe('Sign in');
});
it('shows the protected route only with a restored session', () => {
  state.loading = false;
  state.session = { user: { id: 'fixture-user' } };
  mount();
  expect(screen.getByRole('heading').textContent).toBe('Private household');
});
