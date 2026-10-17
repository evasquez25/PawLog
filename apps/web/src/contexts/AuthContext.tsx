import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
type AuthState = {
  recovering: boolean;
  finishRecovery: () => void;
  session: Session | null;
  loading: boolean;
  error: string;
  configured: boolean;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [recovering, setRecovering] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const previousUser = useRef<string | null>(null);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let authEventSeen = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      authEventSeen = true;
      if (active) {
        if (_event === 'PASSWORD_RECOVERY') setRecovering(true);
        else if (_event === 'SIGNED_OUT') setRecovering(false);
        setSession(next);
        setLoading(false);
        setError('');
        if (previousUser.current !== (next?.user.id ?? null)) queryClient.clear();
        previousUser.current = next?.user.id ?? null;
      }
    });
    void supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active || authEventSeen) return;
        setSession(data.session);
        setLoading(false);
        if (sessionError) setError('Your session could not be restored. Please sign in again.');
      })
      .catch(() => {
        if (active && !authEventSeen) {
          setLoading(false);
          setError('Your session could not be restored. Please sign in again.');
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);
  async function signOut() {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (signOutError) throw new Error('Could not sign out. Please retry.');
    setRecovering(false);
    setSession(null);
    queryClient.clear();
  }
  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        error,
        configured: Boolean(supabase),
        signOut,
        recovering,
        finishRecovery: () => setRecovering(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider required');
  return value;
}
