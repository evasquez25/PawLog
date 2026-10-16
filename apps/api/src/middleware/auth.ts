import type { RequestHandler } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
export type VerifiedIdentity = { userId: string; db: SupabaseClient };
export type VerifyToken = (token: string) => Promise<VerifiedIdentity | null>;
export async function verifySupabaseToken(token: string): Promise<VerifiedIdentity | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw Object.assign(new Error('Supabase not configured'), { status: 503 });
  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  // getUser validates the token with Auth, rather than trusting a decoded payload.
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id, db };
}
export function requireAuth(verify: VerifyToken = verifySupabaseToken): RequestHandler {
  return async (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? '');
    if (!match?.[1] || match[1].length > 8192) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Please sign in to continue.',
          requestId: res.locals.requestId,
        },
      });
      return;
    }
    try {
      const identity = await verify(match[1]);
      if (!identity) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Your session is invalid or expired.',
            requestId: res.locals.requestId,
          },
        });
        return;
      }
      res.locals.identity = identity;
      next();
    } catch {
      res.status(503).json({
        error: {
          code: 'AUTH_UNAVAILABLE',
          message: 'Authentication is temporarily unavailable. Please retry.',
          requestId: res.locals.requestId,
        },
      });
    }
  };
}
