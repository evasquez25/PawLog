import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { ApiRequestError } from '@/services/client';
export function LoadState() {
  return (
    <div className="session-loading" aria-busy="true">
      <div />
      <div />
      <p role="status">Getting your household ready…</p>
    </div>
  );
}
export function ErrorState({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <section className="settings-card" role="alert">
      <h2>We couldn’t load this just yet.</h2>
      <p className="subtext">{error.message}</p>
      <Button variant="outline" className="mt-4 min-h-11" onClick={retry}>
        Try again
      </Button>
      {error instanceof ApiRequestError && error.status === 401 && (
        <Link className="account-demo-link" to="/login">
          Sign in again
        </Link>
      )}
    </section>
  );
}
export function FormMessage({ error, success }: { error?: string; success?: string }) {
  return (
    <>
      <p className="form-error" role="alert">
        {error}
      </p>
      <p className="settings-feedback" role="status">
        {success}
      </p>
    </>
  );
}
