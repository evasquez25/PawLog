import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { uuidSchema } from '@pawlog/shared';
import { supabase } from '@/lib/supabase';
export type CareSyncStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';
const CONNECTED_RECONCILE_MS = 60000;
const FALLBACK_RECONCILE_MS = 15000;
// Postgres Changes applies SELECT RLS. A channel filter alone is not authorization.
export function useCareRealtime(userId: string, householdId: string, enabled: boolean) {
  const cache = useQueryClient();
  const [status, setStatus] = useState<CareSyncStatus>('idle');
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const client = supabase;
    if (
      !client ||
      !enabled ||
      !uuidSchema.safeParse(userId).success ||
      !uuidSchema.safeParse(householdId).success
    )
      return;
    let disposed = false;
    let connected = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let eventTimer: ReturnType<typeof setTimeout> | undefined;
    const pendingPets = new Set<string>();
    const active = () => navigator.onLine && document.visibilityState === 'visible';
    const set = (next: CareSyncStatus) => {
      if (!disposed) setStatus(next);
    };
    const reconcile = () => {
      if (disposed || !active()) return;
      void cache.invalidateQueries({
        predicate: (q) =>
          q.queryKey[1] === userId &&
          (q.queryKey[0] === 'account' ||
            q.queryKey[0] === 'latest' ||
            (['household', 'members', 'pets'].includes(String(q.queryKey[0])) &&
              q.queryKey[2] === householdId)),
      });
    };
    const schedule = () => {
      clearTimeout(timer);
      if (disposed || !active()) return;
      timer = setTimeout(
        () => {
          reconcile();
          schedule();
        },
        connected ? CONNECTED_RECONCILE_MS : FALLBACK_RECONCILE_MS,
      );
    };
    set(navigator.onLine ? 'connecting' : 'offline');
    const channel = client
      .channel(`care:${userId}:${householdId}:${crypto.randomUUID()}`, {
        config: { postgres_changes_options: { wait: true, timeout: 15000 } },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          if (
            disposed ||
            payload.new.household_id !== householdId ||
            !uuidSchema.safeParse(payload.new.pet_id).success
          )
            return;
          pendingPets.add(payload.new.pet_id as string);
          clearTimeout(eventTimer);
          eventTimer = setTimeout(() => {
            if (disposed) return;
            for (const petId of pendingPets)
              void cache.invalidateQueries({ queryKey: ['latest', userId, petId] });
            pendingPets.clear();
          }, 100);
        },
      )
      .subscribe((next) => {
        if (disposed) return;
        connected = next === 'SUBSCRIBED';
        set(!navigator.onLine ? 'offline' : connected ? 'connected' : 'reconnecting');
        // Refetch after every successful join, including SDK-managed reconnects.
        if (connected) reconcile();
        schedule();
      });
    const resume = () => {
      if (disposed) return;
      set(!navigator.onLine ? 'offline' : connected ? 'connected' : 'reconnecting');
      reconcile();
      schedule();
    };
    const reconnect = () => {
      reconcile();
      setGeneration((value) => value + 1);
    };
    window.addEventListener('online', reconnect);
    window.addEventListener('offline', resume);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    // Reconciliation is useful even when a channel joins but events never arrive.
    reconcile();
    schedule();
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(eventTimer);
      pendingPets.clear();
      window.removeEventListener('online', reconnect);
      window.removeEventListener('offline', resume);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
      void client.removeChannel(channel).catch(() => {
        /* SDK owns socket retry/cleanup. */
      });
    };
  }, [cache, userId, householdId, enabled, generation]);
  return enabled && householdId ? status : 'idle';
}
