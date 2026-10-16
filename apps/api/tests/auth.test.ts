import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAuth, type VerifyToken } from '../src/middleware/auth.js';
function server(verify: VerifyToken) {
  const app = express();
  app.use((_req, res, next) => {
    res.locals.requestId = 'test-request';
    next();
  });
  app.get('/protected', requireAuth(verify), (_req, res) =>
    res.json({ id: res.locals.identity.userId }),
  );
  return app;
}
describe('API authentication boundary', () => {
  it('rejects missing authorization without calling the verifier', async () => {
    const verify = vi.fn();
    await request(server(verify)).get('/protected').expect(401);
    expect(verify).not.toHaveBeenCalled();
  });
  it.each(['Basic token', 'Bearer a b', 'Bearer ', `Bearer ${'x'.repeat(8193)}`])(
    'rejects malformed authorization',
    async (header) => {
      const verify = vi.fn();
      await request(server(verify)).get('/protected').set('Authorization', header).expect(401);
      expect(verify).not.toHaveBeenCalled();
    },
  );
  it('rejects a token when verification fails', async () => {
    const verify = vi.fn().mockResolvedValue(null);
    await request(server(verify))
      .get('/protected')
      .set('Authorization', 'Bearer expired-token')
      .expect(401);
  });
  it('uses the verified identity rather than client-supplied IDs', async () => {
    const verify = vi.fn().mockResolvedValue({ userId: 'verified-user', db: {} as SupabaseClient });
    const response = await request(server(verify))
      .get('/protected?userId=other-user')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);
    expect(response.body.id).toBe('verified-user');
    expect(verify).toHaveBeenCalledWith('valid-token');
  });
  it('returns a retriable error without leaking verifier details', async () => {
    const verify = vi.fn().mockRejectedValue(new Error('private configuration details'));
    const response = await request(server(verify))
      .get('/protected')
      .set('Authorization', 'Bearer valid-token')
      .expect(503);
    expect(response.body.error.code).toBe('AUTH_UNAVAILABLE');
    expect(JSON.stringify(response.body)).not.toContain('private configuration details');
  });
});
