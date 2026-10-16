import { Navigate, Outlet } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';
export function ProtectedRoute() {
  const { loading, session } = useAuth();
  if (loading)
    return (
      <main className="session-loading" aria-busy="true" aria-label="Loading your session">
        <div />
        <div />
        <div />
        <p role="status">Getting your household ready…</p>
      </main>
    );
  return session ? <Outlet /> : <Navigate to="/login" replace />;
}
