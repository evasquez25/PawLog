import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { PawPrint } from 'lucide-react';
import { supabase, recoveryLinkError } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useOnline } from '@/hooks/useOnline';
import { Button } from '@/components/ui/button';

export function PasswordRecoveryPage({ reset = false }: { reset?: boolean }) {
  const { session, loading, configured, finishRecovery } = useAuth();
  const online = useOnline();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(recoveryLinkError);
  const valid = reset && !loading && !!session && !invalid;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !online || !supabase || (reset && !valid)) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const password = String(fields.get('password') ?? '');
    setMessage('');
    if (reset && (password.length < 8 || password !== fields.get('confirm'))) {
      setMessage('Use at least 8 characters and make sure both passwords match.');
      return;
    }
    busy.current = true;
    setPending(true);
    try {
      if (reset) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          if (
            [401, 403].includes(error.status ?? 0) ||
            ['session_not_found', 'refresh_token_not_found'].includes(error.code ?? '')
          )
            setInvalid(true);
          setMessage(
            error.code === 'same_password'
              ? 'Choose a password different from your current password.'
              : error.code === 'weak_password'
                ? 'Choose a stronger password and try again.'
                : 'Your password could not be updated. Try again, or request a fresh reset link.',
          );
          return;
        }
        form.reset();
        finishRecovery();
        setDone(true);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(
          String(fields.get('email') ?? '').trim(),
          { redirectTo: `${window.location.origin}/reset-password` },
        );
        if (error && error.status === 429) {
          setMessage('Too many requests. Please wait a few minutes before trying again.');
          return;
        }
        // Do not expose whether an address exists or disclose provider/account details.
        if (error && (!error.status || error.status >= 500)) {
          setMessage('The email service is unavailable. Please try again later.');
          return;
        }
        setDone(true);
        form.reset();
      }
    } catch {
      setMessage('Could not connect. Check your connection and try again.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <main className="recovery-page">
      <Link className="brand" to={valid ? '/app' : '/login'} onClick={finishRecovery}>
        <span className="brand-mark">
          <PawPrint />
        </span>
        PawLog.
      </Link>
      <section className="settings-card" aria-labelledby="recovery-title">
        <h1 id="recovery-title">{reset ? 'Choose a new password.' : 'Forgot your password?'}</h1>
        {done ? (
          <>
            <p role="status">
              {reset
                ? 'Your password has been updated.'
                : 'If an account exists for this address, you’ll receive a password-reset email. Check your inbox and spam folder, then open the newest link.'}
            </p>
            <Link className="account-demo-link" to={reset ? '/app' : '/login'}>
              {reset ? 'Continue to PawLog →' : 'Back to sign in →'}
            </Link>
          </>
        ) : reset && loading ? (
          <p role="status">Checking your reset link…</p>
        ) : reset && !valid ? (
          <>
            <p role="alert">
              This reset link is missing, expired, or no longer valid. Request a new email and use
              its newest link.
            </p>
            <Link className="account-demo-link" to="/forgot-password" onClick={finishRecovery}>
              Request a new reset link →
            </Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <p className="subtext">
              {reset
                ? 'Use a password you haven’t used before.'
                : 'Enter your account’s email address and we’ll send you a reset link.'}
            </p>
            {reset ? (
              <>
                <label htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  aria-describedby="recovery-help"
                  disabled={pending}
                />
                <p id="recovery-help" className="field-hint">
                  At least 8 characters. A longer, unique password is better.
                </p>
                <label htmlFor="confirm-password">Confirm new password</label>
                <input
                  id="confirm-password"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={pending}
                />
              </>
            ) : (
              <>
                <label htmlFor="recovery-email">Email address</label>
                <input
                  id="recovery-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={pending}
                />
              </>
            )}
            <Button className="save-button mt-5" disabled={pending || !online || !configured}>
              {pending ? 'Please wait…' : reset ? 'Update password' : 'Send reset email'}
            </Button>
          </form>
        )}
        {!online && (
          <p role="status" className="form-error">
            You’re offline. Reconnect to continue.
          </p>
        )}
        {!configured && (
          <p role="alert" className="form-error">
            Sign-in is not configured. Please contact the app owner.
          </p>
        )}
        {message && (
          <p role="alert" className="form-error">
            {message}
          </p>
        )}
        {!done && (
          <Link
            className="account-demo-link"
            to={valid ? '/app' : '/login'}
            onClick={finishRecovery}
          >
            {valid ? 'Continue without changing password →' : 'Back to sign in →'}
          </Link>
        )}
      </section>
    </main>
  );
}
