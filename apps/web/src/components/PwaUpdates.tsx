import { useEffect, useState } from 'react';
export function PwaUpdates() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let applying = false;
    const inspect = () => {
      if (!disposed)
        setWaiting(navigator.serviceWorker.controller ? (registration?.waiting ?? null) : null);
    };
    const watch = () => {
      const worker = registration?.installing;
      worker?.addEventListener('statechange', inspect);
    };
    const reload = () => {
      if (applying) window.location.reload();
    };
    const check = () => {
      if (navigator.onLine && document.visibilityState === 'visible')
        void registration?.update().catch(() => {});
    };
    const apply = () => {
      applying = true;
    };
    window.addEventListener('pawlog:apply-update', apply);
    navigator.serviceWorker.addEventListener('controllerchange', reload);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', check);
    void navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        if (disposed) return;
        registration = reg;
        inspect();
        reg.addEventListener('updatefound', watch);
        watch();
      })
      .catch(() => {
        if (!disposed)
          setError(
            'Home-screen offline support could not start. You can keep using PawLog online.',
          );
      });
    return () => {
      disposed = true;
      registration?.removeEventListener('updatefound', watch);
      navigator.serviceWorker.removeEventListener('controllerchange', reload);
      window.removeEventListener('pawlog:apply-update', apply);
      window.removeEventListener('online', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  if (error)
    return (
      <div className="offline-banner" role="status">
        {error}
      </div>
    );
  if (!waiting) return null;
  return (
    <div className="pwa-update" role="status">
      <span>A new PawLog version is ready. Finish any open entry before updating.</span>
      <button
        disabled={updating}
        onClick={async () => {
          setUpdating(true);
          window.dispatchEvent(new Event('pawlog:apply-update'));
          try {
            const registration = await navigator.serviceWorker.getRegistration('/');
            const worker = registration?.waiting;
            // Another tab can already have activated the version shown in this prompt.
            if (!worker) {
              window.location.reload();
              return;
            }
            worker.addEventListener('statechange', () => {
              if (worker.state === 'activated') window.location.reload();
            });
            worker.postMessage({ type: 'SKIP_WAITING' });
          } catch {
            setUpdating(false);
            setError(
              'The update could not start. Reconnect and reload PawLog after finishing your entry.',
            );
          }
        }}
      >
        {updating ? 'Updating…' : 'Update now'}
      </button>
      <button onClick={() => setWaiting(null)}>Later</button>
    </div>
  );
}
