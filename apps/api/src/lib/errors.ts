import type { ErrorRequestHandler } from 'express';
import { ZodError } from '@pawlog/shared';
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export function databaseError(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === '42501')
    throw new HttpError(403, 'FORBIDDEN', 'You do not have permission for this action.');
  if (['22023', '23514', '23502', '23503', '22P02'].includes(error.code ?? ''))
    throw new HttpError(400, 'INVALID_INPUT', 'Please check the submitted values.');
  if (error.code === '23505') throw new HttpError(409, 'CONFLICT', 'This record already exists.');
  if (['PGRST202', 'PGRST205', '42703'].includes(error.code ?? ''))
    throw new HttpError(
      503,
      'MIGRATION_REQUIRED',
      'The latest database migration needs to be applied.',
    );
  throw new HttpError(
    503,
    'DATABASE_UNAVAILABLE',
    'The data service is unavailable. Please retry.',
  );
}
export const handleError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  const requestId = res.locals.requestId as string;
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please check the submitted values.',
        requestId,
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }
  if (error instanceof HttpError) {
    if (error.status === 429) res.setHeader('Retry-After', '900');
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        requestId,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    });
    return;
  }
  const status =
    typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
  const clientError = status >= 400 && status < 500;
  if (!clientError) console.error('API request failed', { requestId, error });
  res.status(clientError ? status : 500).json({
    error: {
      code: clientError ? 'INVALID_REQUEST' : 'INTERNAL_ERROR',
      message: clientError
        ? 'The request could not be read.'
        : 'Something went wrong. Please try again.',
      requestId,
    },
  });
};
