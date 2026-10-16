import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { accountRoutes } from './routes/account.js';
import { pawlogRoutes } from './routes/pawlog.js';
import { handleError } from './lib/errors.js';
import type { VerifyToken } from './middleware/auth.js';
import { healthResponseSchema, type ApiError } from '@pawlog/shared';

export function createApp(verify?: VerifyToken) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.locals.requestId = randomUUID();
    res.setHeader('X-Request-Id', res.locals.requestId as string);
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(helmet());
  // Production uses one origin. An explicit origin is only needed for separate clients.
  if (process.env.WEB_ORIGIN) {
    app.use(cors({ origin: process.env.WEB_ORIGIN }));
  }
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/health', (_req, res) => {
    res.json(healthResponseSchema.parse({ data: { status: 'ok', service: 'pawlog-api' } }));
  });
  app.use('/api', accountRoutes(verify));
  app.use('/api', pawlogRoutes(verify));
  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'This endpoint does not exist.',
        requestId: res.locals.requestId as string,
      },
    } satisfies ApiError);
  });
  app.use(handleError);
  return app;
}
export const app = createApp();
export default app;
