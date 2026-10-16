// @vitest-environment jsdom
import React from 'react';
import { renderHook, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { useCareRealtime } from '../hooks/useCareRealtime';
type Handler = (payload: { new: Record<string, unknown> }) => void;
const transport = vi.hoisted(() => {
  const channels: {
    name: string;
    options: unknown;
    handlers: Handler[];
    status?: (status: string) => void;
    on: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  }[] = [];
  const client = {
    channel: vi.fn((name: string, options: unknown) => {
      const channel = {
        name,
        options,
        handlers: [] as Handler[],
        status: undefined as ((status: string) => void) | undefined,
        on: vi.fn(),
        subscribe: vi.fn(),
      };
      channel.on.mockImplementation((_event: string, _filter: unknown, handler: Handler) => {
        channel.handlers.push(handler);
        return channel;
      });
      channel.subscribe.mockImplementation((callback: (status: string) => void) => {
        channel.status = callback;
        return channel;
      });
      channels.push(channel);
      return channel;
    }),
    removeChannel: vi.fn().mockResolvedValue('ok'),
  };
  return { channels, client };
});
vi.mock('../lib/supabase', () => ({ supabase: transport.client }));
const user = '00000000-0000-4000-8000-000000000001',
  household = '00000000-0000-4000-8000-000000000002',
  otherHousehold = '00000000-0000-4000-8000-000000000003',
  pet = '00000000-0000-4000-8000-000000000004';
let cache: QueryClient;
let invalidate: ReturnType<typeof vi.spyOn>;
function mount(id = household, enabled = true) {
  return renderHook(({ id, enabled }) => useCareRealtime(user, id, enabled), {
    initialProps: { id, enabled },
    wrapper: ({ children }) =>
      React.createElement(QueryClientProvider, { client: cache }, children),
  });
}
function event(index = 0, hh = household, p = pet) {
  transport.channels[index]!.handlers[0]!({ new: { household_id: hh, pet_id: p } });
}
beforeEach(() => {
  vi.useFakeTimers();
  transport.channels.length = 0;
  transport.client.channel.mockClear();
  transport.client.removeChannel.mockClear();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  invalidate = vi.spyOn(cache, 'invalidateQueries').mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  cache.clear();
  vi.useRealTimers();
});
describe('care realtime lifecycle', () => {
  it('subscribes only after membership is ready and uses a household INSERT filter', () => {
    const hook = mount(household, false);
    expect(transport.client.channel).not.toHaveBeenCalled();
    hook.rerender({ id: household, enabled: true });
    expect(transport.channels[0]?.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_logs',
        filter: `household_id=eq.${household}`,
      },
      expect.any(Function),
    );
    expect(transport.channels[0]?.options).toMatchObject({
      config: { postgres_changes_options: { wait: true } },
    });
  });
  it('invalidates only the affected pet and coalesces bursts without installing payload data', () => {
    cache.setQueryData(['latest', user, pet], ['authoritative existing data']);
    mount();
    invalidate.mockClear();
    act(() => {
      event();
      event();
      vi.advanceTimersByTime(100);
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['latest', user, pet] });
    expect(cache.getQueryData(['latest', user, pet])).toEqual(['authoritative existing data']);
  });
  it('ignores other-household and malformed events', () => {
    mount();
    invalidate.mockClear();
    act(() => {
      event(0, otherHousehold);
      event(0, household, 'not-a-uuid');
      vi.advanceTimersByTime(100);
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
  it('removes the old channel on household switch and ignores late callbacks', () => {
    const hook = mount();
    const old = transport.channels[0]!;
    hook.rerender({ id: otherHousehold, enabled: true });
    expect(transport.client.removeChannel).toHaveBeenCalledWith(old);
    invalidate.mockClear();
    act(() => {
      old.status?.('SUBSCRIBED');
      event();
      vi.advanceTimersByTime(100);
    });
    expect(invalidate).not.toHaveBeenCalled();
    expect(transport.channels[1]?.name).toContain(otherHousehold);
  });
  it('refetches authoritative queries after initial join and reconnection', () => {
    const hook = mount();
    invalidate.mockClear();
    act(() => transport.channels[0]!.status?.('SUBSCRIBED'));
    expect(hook.result.current).toBe('connected');
    expect(invalidate).toHaveBeenCalled();
    act(() => transport.channels[0]!.status?.('CHANNEL_ERROR'));
    expect(hook.result.current).toBe('reconnecting');
    invalidate.mockClear();
    act(() => transport.channels[0]!.status?.('SUBSCRIBED'));
    expect(invalidate).toHaveBeenCalled();
  });
  it('uses a 15-second fallback for failed subscriptions and 60-second reconciliation when connected', () => {
    mount();
    act(() => transport.channels[0]!.status?.('TIMED_OUT'));
    invalidate.mockClear();
    act(() => vi.advanceTimersByTime(15000));
    expect(invalidate).toHaveBeenCalledOnce();
    act(() => transport.channels[0]!.status?.('SUBSCRIBED'));
    invalidate.mockClear();
    act(() => vi.advanceTimersByTime(15000));
    expect(invalidate).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(45000));
    expect(invalidate).toHaveBeenCalledOnce();
  });
  it('pauses polling while hidden and refetches on return', () => {
    mount();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    invalidate.mockClear();
    act(() => vi.advanceTimersByTime(60000));
    expect(invalidate).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(invalidate).toHaveBeenCalled();
  });
  it('does not poll offline and opens a fresh channel after connectivity returns', () => {
    const hook = mount();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    act(() => window.dispatchEvent(new Event('offline')));
    expect(hook.result.current).toBe('offline');
    invalidate.mockClear();
    act(() => vi.advanceTimersByTime(60000));
    expect(invalidate).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    act(() => window.dispatchEvent(new Event('online')));
    expect(transport.channels).toHaveLength(2);
    expect(transport.client.removeChannel).toHaveBeenCalledWith(transport.channels[0]);
    expect(invalidate).toHaveBeenCalled();
  });
  it('cleans up pending invalidations, polling, and listeners on logout/unmount', () => {
    const hook = mount();
    act(() => event());
    hook.unmount();
    invalidate.mockClear();
    act(() => {
      vi.advanceTimersByTime(60000);
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('online'));
      transport.channels[0]!.status?.('SUBSCRIBED');
    });
    expect(invalidate).not.toHaveBeenCalled();
    expect(transport.client.removeChannel).toHaveBeenCalledOnce();
  });
  it('invalidates both independent query clients when the same household event arrives', () => {
    mount();
    const first = invalidate;
    const secondCache = new QueryClient();
    const second = vi.spyOn(secondCache, 'invalidateQueries').mockResolvedValue(undefined);
    const other = renderHook(
      () => useCareRealtime('00000000-0000-4000-8000-000000000005', household, true),
      {
        wrapper: ({ children }) =>
          React.createElement(QueryClientProvider, { client: secondCache }, children),
      },
    );
    first.mockClear();
    second.mockClear();
    act(() => {
      event(0);
      event(1);
      vi.advanceTimersByTime(100);
    });
    expect(first).toHaveBeenCalledWith({ queryKey: ['latest', user, pet] });
    expect(second).toHaveBeenCalledWith({
      queryKey: ['latest', '00000000-0000-4000-8000-000000000005', pet],
    });
    other.unmount();
    secondCache.clear();
  });
});
