// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PasswordRecoveryPage } from '@/pages/PasswordRecoveryPage';
const state = vi.hoisted(() => ({
  session: null as object | null,
  loading: false,
  configured: true,
  finishRecovery: vi.fn(),
  online: true,
  linkError: false,
  send: vi.fn(),
  update: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => state }));
vi.mock('@/hooks/useOnline', () => ({ useOnline: () => state.online }));
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { resetPasswordForEmail: state.send, updateUser: state.update } },
  get recoveryLinkError() {
    return state.linkError;
  },
}));
beforeEach(() => {
  state.session = null;
  state.loading = false;
  state.configured = true;
  state.online = true;
  state.linkError = false;
  state.finishRecovery.mockReset();
  state.send.mockReset().mockResolvedValue({ error: null });
  state.update.mockReset().mockResolvedValue({ error: null });
});
afterEach(() => cleanup());
function mount(reset = false) {
  render(createElement(MemoryRouter, null, createElement(PasswordRecoveryPage, { reset })));
}
function passwords(a = 'safe-fixture-password', b = a) {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: a } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: b } });
  fireEvent.submit(screen.getByRole('button', { name: 'Update password' }).closest('form')!);
}
it('sends the correct callback and displays a neutral account-existence message', async () => {
  mount();
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'person@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send reset email' }));
  await screen.findByRole('status');
  expect(state.send).toHaveBeenCalledWith('person@example.com', {
    redirectTo: window.location.origin + '/reset-password',
  });
  expect(screen.getByRole('status').textContent).toContain('If an account exists');
});
it('does not reveal provider details for an account-related rejection', async () => {
  state.send.mockResolvedValue({ error: { status: 400, message: 'User does not exist' } });
  mount();
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'unknown@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send reset email' }));
  expect((await screen.findByRole('status')).textContent).toContain('If an account exists');
  expect(screen.queryByText('User does not exist')).toBeNull();
});
it('prevents double email submissions while waiting', async () => {
  state.send.mockReturnValue(new Promise(() => {}));
  mount();
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'person@example.com' },
  });
  const form = screen.getByRole('button', { name: 'Send reset email' }).closest('form')!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  await waitFor(() => expect(state.send).toHaveBeenCalledOnce());
});
it('shows retry guidance on rate limits without claiming an email was sent', async () => {
  state.send.mockResolvedValue({ error: { status: 429 } });
  mount();
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'person@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send reset email' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Too many');
  expect(screen.queryByText(/If an account exists/)).toBeNull();
});
it('rejects missing sessions and expired links even if another session exists', () => {
  mount(true);
  expect(screen.getByRole('alert').textContent).toContain('expired');
  expect(screen.queryByLabelText('New password')).toBeNull();
  cleanup();
  state.session = {};
  state.linkError = true;
  mount(true);
  expect(screen.queryByLabelText('New password')).toBeNull();
  expect(state.update).not.toHaveBeenCalled();
});
it('waits for recovery session initialization', () => {
  state.loading = true;
  mount(true);
  expect(screen.getByRole('status').textContent).toContain('Checking');
  expect(screen.queryByRole('alert')).toBeNull();
});
it('rejects short or mismatched passwords before calling Supabase', () => {
  state.session = {};
  mount(true);
  passwords('short', 'short');
  expect(screen.getByRole('alert').textContent).toContain('8 characters');
  passwords('long-fixture-password', 'different-password');
  expect(state.update).not.toHaveBeenCalled();
});
it('updates through Supabase and clears the recovery state only after success', async () => {
  state.session = {};
  mount(true);
  passwords();
  expect((await screen.findByRole('status')).textContent).toContain('updated');
  expect(state.update).toHaveBeenCalledWith({ password: 'safe-fixture-password' });
  expect(state.finishRecovery).toHaveBeenCalledOnce();
  expect(screen.queryByLabelText('New password')).toBeNull();
});
it('handles expired sessions during submission without showing success', async () => {
  state.session = {};
  state.update.mockResolvedValue({ error: { status: 401 } });
  mount(true);
  passwords();
  await waitFor(() => expect(screen.queryByLabelText('New password')).toBeNull());
  expect(screen.queryByText('Your password has been updated.')).toBeNull();
  expect(state.finishRecovery).not.toHaveBeenCalled();
});
it('disables requests while offline', () => {
  state.online = false;
  mount();
  const button = screen.getByRole('button', { name: 'Send reset email' }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.submit(button.closest('form')!);
  expect(state.send).not.toHaveBeenCalled();
});
