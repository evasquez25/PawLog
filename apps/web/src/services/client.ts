import { ZodError } from '@pawlog/shared';
import { supabase } from '@/lib/supabase';
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 0,
    public details?: unknown,
  ) {
    super(message);
  }
}
export async function apiRequest<T>(
  path: string,
  schema: { parse: (input: unknown) => T },
  options: { method?: string; body?: unknown; signal?: AbortSignal; idempotencyKey?: string } = {},
): Promise<T> {
  if (!navigator.onLine)
    throw new ApiRequestError('You’re offline. Reconnect and try again.', 'OFFLINE');
  if (!supabase) throw new ApiRequestError('Sign-in is not configured.', 'NOT_CONFIGURED');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session)
    throw new ApiRequestError('Your session expired. Please sign in again.', 'UNAUTHORIZED', 401);
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiRequestError(
      options.method && options.method !== 'GET'
        ? options.idempotencyKey
          ? 'The save could not be confirmed. Retry to check its result.'
          : 'The result could not be confirmed. Refresh to check before trying again.'
        : 'Could not connect. Check your connection and retry.',
      'NETWORK_ERROR',
    );
  }
  const result = await response.json().catch(() => null);
  if (response.status === 401) {
    // Clear an invalid local session so the sign-in screen cannot loop back to /app.
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      /* The original auth error is still shown. */
    }
  }
  if (!response.ok)
    throw new ApiRequestError(
      result?.error?.message ?? 'The request could not be completed. Please retry.',
      result?.error?.code ?? 'REQUEST_FAILED',
      response.status,
      result?.error?.details,
    );
  try {
    return schema.parse(result?.data);
  } catch {
    throw new ApiRequestError(
      'The data could not be read. Refresh and try again.',
      'INVALID_RESPONSE',
    );
  }
}

export function formError(error: unknown) {
  if (error instanceof ZodError) return error.issues[0]?.message ?? 'Please check the form.';
  return error instanceof Error ? error.message : 'Something went wrong. Please retry.';
}
