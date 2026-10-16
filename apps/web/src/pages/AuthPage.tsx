import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PawPrint, ArrowRight, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PetPortrait } from '@/components/pets/PetPortrait';
export function AuthPage({ register = false }: { register?: boolean }) {
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const { session, loading, configured, error: sessionError } = useAuth();
  if (!loading && session) return <Navigate to="/app" replace />;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!supabase) {
      setMessage(
        'Supabase is not configured yet. Follow docs/supabase-setup.md to enable real accounts. No credentials were sent.',
      );
      return;
    }
    const form = event.currentTarget;
    const values = new FormData(form);
    setPending(true);
    setMessage('');
    try {
      const email = String(values.get('email') ?? '').trim();
      const password = String(values.get('password') ?? '');
      if (register) {
        const displayName = String(values.get('display_name') ?? '').trim();
        if (!displayName) {
          setMessage('Please enter your name.');
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: `${window.location.origin}/app`,
          },
        });
        if (error) {
          setMessage(
            'Registration could not be completed. Check your details and try again. If you already have an account, sign in.',
          );
          return;
        }
        if (!data.session)
          setMessage(
            'Check your email for a confirmation link. If an account already exists, sign in.',
          );
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setMessage(
            error.code === 'email_not_confirmed'
              ? 'Confirm your email before signing in.'
              : 'Sign-in failed. Check your email and password, or try again when connected.',
          );
          return;
        }
      }
      form.reset();
    } catch {
      setMessage('Could not connect. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <PawPrint />
          </span>
          PawLog.
        </Link>
        <div>
          <span className="eyebrow">A LITTLE CARE GOES A LONG WAY</span>
          <h1>
            Happy pets.
            <br />
            Happy households.
          </h1>
          <p>
            Less “has anyone fed Max?”
            <br />
            More moments that matter.
          </p>
          <div className="auth-portrait">
            <PetPortrait />
          </div>
          <span className="auth-caption">
            <Heart size={16} /> Every pet deserves a whole team.
          </span>
        </div>
      </section>
      <main className="auth-form-wrap">
        <span className="sample-label">
          {configured
            ? 'Your household, securely connected'
            : 'Setup required · Supabase not connected'}
        </span>
        <h2>{register ? 'Make care a family thing.' : 'Welcome back, pet person.'}</h2>
        <p className="subtext">
          {register
            ? 'Your household’s next happy habit starts here.'
            : 'Your little sidekick is in good company.'}
        </p>
        <form onSubmit={submit}>
          {register && (
            <>
              <label htmlFor="name">Your name</label>
              <input id="name" name="display_name" autoComplete="name" required maxLength={60} />
            </>
          )}
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={register ? 'new-password' : 'current-password'}
            minLength={8}
            required
            aria-describedby="password-help"
          />
          <p id="password-help" className="field-hint">
            {register
              ? 'At least 8 characters.'
              : 'Your password is handled securely by Supabase Auth.'}
          </p>
          <Button
            className="save-button"
            type="submit"
            disabled={pending || loading || !configured}
          >
            {pending ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
            <ArrowRight size={17} />
          </Button>
          <p className="auth-message" role="status">
            {message || sessionError}
          </p>
        </form>
        <p className="field-hint">
          {!configured &&
            'Real sign-in requires your Supabase project. The sample household remains available below.'}
        </p>
        <p className="auth-switch">
          {register ? 'Already part of the pack?' : 'New to PawLog?'}{' '}
          <Link to={register ? '/login' : '/register'}>
            {register ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
        <div className="demo-entry">
          <p>Take a look around first.</p>
          <Link to="/demo">
            Explore the sample household <ArrowRight size={17} />
          </Link>
          <small>No account needed. Nothing is saved to a server.</small>
        </div>
      </main>
    </div>
  );
}
