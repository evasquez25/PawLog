// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import type { ActivityType } from '@pawlog/shared';
import { LiveLogSheet } from '../components/live/LiveLogSheet';
import { apiRequest, ApiRequestError } from '../services/client';
const actor = '00000000-0000-4000-8000-000000000001',
  pet = '00000000-0000-4000-8000-000000000002',
  type = '00000000-0000-4000-8000-000000000003',
  other = '00000000-0000-4000-8000-000000000004';
vi.mock('../contexts/HouseholdContext', () => ({
  useHousehold: () => ({
    userId: actor,
    petId: pet,
    pet: { id: pet, name: 'Max' },
    members: {
      data: [
        { user_id: actor, profile: { display_name: 'Eric' } },
        { user_id: other, profile: { display_name: 'Sarah' } },
      ],
    },
  }),
}));
vi.mock('../hooks/useOnline', () => ({ useOnline: () => true }));
vi.mock('../services/client', async (original) => {
  const actual = await original<typeof import('../services/client')>();
  return { ...actual, apiRequest: vi.fn() };
});
const activity: ActivityType = {
  id: type,
  household_id: actor,
  key: 'feeding',
  name: 'Feeding',
  icon: 'bone',
  color: 'sage',
  sort_order: 0,
  is_active: true,
};
let cache: QueryClient;
let saved = vi.fn<() => void>();
let closed = vi.fn<() => void>();
const log = {
  id: other,
  pet_id: pet,
  activity_type_id: type,
  performed_by: actor,
  logged_by: actor,
  performed_at: new Date(Date.now() - 60000).toISOString(),
  notes: '',
};
beforeEach(() => {
  vi.mocked(apiRequest).mockReset();
  cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  saved = vi.fn();
  closed = vi.fn();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  cleanup();
  cache.clear();
});
function mount() {
  render(
    React.createElement(
      QueryClientProvider,
      { client: cache },
      React.createElement(LiveLogSheet, { activity, onClose: closed, onSaved: saved }),
    ),
  );
}
it('preselects the current member and focuses the member field', () => {
  mount();
  expect((screen.getByLabelText('Who completed this?') as HTMLSelectElement).value).toBe(actor);
  expect(document.activeElement).toBe(screen.getByLabelText('Who completed this?'));
});
it('blocks double submission and only announces success after confirmation', async () => {
  let resolve: (value: unknown) => void = () => {};
  vi.mocked(apiRequest).mockReturnValue(new Promise((done) => (resolve = done)));
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Save Activity' }));
  fireEvent.submit(screen.getByRole('button', { name: 'Save Activity' }).closest('form')!);
  await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));
  expect(saved).not.toHaveBeenCalled();
  resolve({ log, replayed: false });
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
});
it('retains the timestamp, performer, body and idempotency key after an uncertain save', async () => {
  vi.mocked(apiRequest)
    .mockRejectedValueOnce(new ApiRequestError('Unconfirmed', 'NETWORK_ERROR'))
    .mockResolvedValueOnce({ log, replayed: true });
  mount();
  fireEvent.change(screen.getByLabelText('Who completed this?'), { target: { value: other } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Activity' }));
  await screen.findByRole('button', { name: 'Retry to confirm' });
  expect(saved).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry to confirm' }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(vi.mocked(apiRequest).mock.calls[0]).toEqual(vi.mocked(apiRequest).mock.calls[1]);
});
it('requires Log Anyway after a server feeding warning', async () => {
  vi.mocked(apiRequest)
    .mockRejectedValueOnce(
      new ApiRequestError('Recent feeding', 'RECENT_FEEDING', 409, {
        latest: log,
        warning_minutes: 15,
      }),
    )
    .mockResolvedValueOnce({ log, replayed: false });
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Save Activity' }));
  const override = await screen.findByRole('button', { name: 'Log Anyway' });
  expect(saved).not.toHaveBeenCalled();
  fireEvent.click(override);
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  const first = vi.mocked(apiRequest).mock.calls[0]?.[2];
  const second = vi.mocked(apiRequest).mock.calls[1]?.[2];
  expect(second?.idempotencyKey).toBe(first?.idempotencyKey);
  expect((second?.body as { allow_recent: boolean }).allow_recent).toBe(true);
});
it('keeps a newer dashboard completion after a confirmed backdated save', async () => {
  const newer = {
    ...log,
    id: '00000000-0000-4000-8000-000000000009',
    performed_at: new Date().toISOString(),
    performed_by_name: 'Eric',
  };
  cache.setQueryData(['latest', actor, pet], [{ activity_type: activity, latest: newer }]);
  vi.mocked(apiRequest).mockResolvedValue({ log, replayed: false });
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Save Activity' }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(cache.getQueryData(['latest', actor, pet])).toEqual([
    { activity_type: activity, latest: newer },
  ]);
});

it('blocks dismissal while saving and restores cancellation after a failed request', async () => {
  let reject: (error: Error) => void = () => {};
  vi.mocked(apiRequest).mockReturnValue(new Promise((_resolve, fail) => (reject = fail)));
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Save Activity' }));
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(closed).not.toHaveBeenCalled();
  reject(new ApiRequestError('Try again', 'NETWORK_ERROR'));
  await screen.findByRole('button', { name: 'Retry to confirm' });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(closed).toHaveBeenCalledOnce();
});
