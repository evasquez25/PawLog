import { Router } from 'express';
import { requireAuth, type VerifyToken, type VerifiedIdentity } from '../middleware/auth.js';
export function accountRoutes(verify?: VerifyToken) {
  const router = Router();
  router.get('/me', requireAuth(verify), async (_req, res, next) => {
    try {
      const { userId, db } = res.locals.identity as VerifiedIdentity;
      // User-scoped client carries the validated token. RLS checks current membership.
      const [profile, households] = await Promise.all([
        db.from('profiles').select('id, display_name').eq('id', userId).single(),
        db.from('households').select('id, name').order('created_at'),
      ]);
      if (profile.error || households.error) throw new Error('Account query failed');
      res.json({ data: { profile: profile.data, households: households.data } });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
