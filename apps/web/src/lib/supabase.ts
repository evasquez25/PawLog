import { createClient } from '@supabase/supabase-js';
// Capture callback failures before the Auth SDK processes and cleans the URL.
const callback = new URLSearchParams(window.location.hash.slice(1));
const query = new URLSearchParams(window.location.search);
export const recoveryLinkError =
  window.location.pathname === '/reset-password' &&
  (callback.has('error') ||
    callback.has('error_code') ||
    query.has('error') ||
    query.has('error_code'));
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
// Missing configuration must never silently fall back to pretend authentication.
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;
