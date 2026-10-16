import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes, Link, Navigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DemoProvider } from '@/contexts/DemoContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { LoadState } from '@/components/live/Feedback';
import './styles.css';
import { PwaUpdates } from '@/components/PwaUpdates';
const LiveRoot = lazy(() => import('@/components/live/LiveLayout'));
const LiveDashboard = lazy(() =>
  import('@/pages/LiveDashboardPage').then((m) => ({ default: m.LiveDashboardPage })),
);
const LiveSettings = lazy(() =>
  import('@/pages/LiveSettingsPage').then((m) => ({ default: m.LiveSettingsPage })),
);
const HouseholdSetup = lazy(() =>
  import('@/pages/HouseholdSetupPage').then((m) => ({ default: m.HouseholdSetupPage })),
);
const DemoLayout = lazy(() =>
  import('@/components/layout/AppLayout').then((m) => ({ default: m.AppLayout })),
);
const DemoDashboard = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const DemoSettings = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const AuthPage = lazy(() => import('@/pages/AuthPage').then((m) => ({ default: m.AuthPage })));
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: true, refetchOnReconnect: true },
    mutations: { retry: false, networkMode: 'always' },
  },
});
function Start() {
  const { session, loading } = useAuth();
  return loading ? <LoadState /> : <Navigate to={session ? '/app' : '/login'} replace />;
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DemoProvider>
          <BrowserRouter>
            <PwaUpdates />
            <Suspense fallback={<LoadState />}>
              <Routes>
                <Route path="/" element={<Start />} />
                <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/app" element={<LiveRoot />}>
                    <Route index element={<LiveDashboard />} />
                    <Route path="settings" element={<LiveSettings />} />
                    <Route path="households" element={<HouseholdSetup />} />
                  </Route>
                </Route>
                <Route path="/demo" element={<DemoLayout />}>
                  <Route index element={<DemoDashboard />} />
                  <Route path="settings" element={<DemoSettings />} />
                </Route>
                <Route path="/login" element={<AuthPage key="login" />} />
                <Route path="/register" element={<AuthPage key="register" register />} />
                <Route
                  path="*"
                  element={
                    <main className="page">
                      <h1>That page wandered off.</h1>
                      <Link to="/">Return home</Link>
                    </main>
                  }
                />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </DemoProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
