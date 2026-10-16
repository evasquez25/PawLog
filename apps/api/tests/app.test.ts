import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { healthResponseSchema } from '@pawlog/shared';
describe('API foundation', () => {
  it('returns the shared health contract without caching', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(healthResponseSchema.safeParse(response.body).success).toBe(true);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-request-id']).toBeTruthy();
  });
  it('returns a JSON error for unknown API routes', async () => {
    const response = await request(app).get('/api/missing').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
  it('handles malformed JSON without exposing parser details', async () => {
    const response = await request(app)
      .post('/api/missing')
      .set('Content-Type', 'application/json')
      .send('{broken')
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_REQUEST');
    expect(response.body.error.message).toBe('The request could not be read.');
  });
});
