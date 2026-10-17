import { hashCode } from '../src/services/pawlog.js';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createApp } from '../src/app.js';
const household = '00000000-0000-4000-8000-000000000001';
const pet = '00000000-0000-4000-8000-000000000002';
const actor = '00000000-0000-4000-8000-000000000003';
const activityType = '00000000-0000-4000-8000-000000000004';
const performer = '00000000-0000-4000-8000-000000000005';
const key = '00000000-0000-4000-8000-000000000006';
const payload = () => ({
  activity_type_id: activityType,
  performed_by: performer,
  performed_at: new Date(Date.now() - 60000).toISOString(),
  notes: 'Dinner',
});
let role: string;
let visible: boolean;
const rpc = vi.fn();
const from = vi.fn((table: string) => {
  const value = () => ({
    data:
      table === 'household_members'
        ? visible
          ? { role }
          : null
        : table === 'pets'
          ? visible
            ? { id: pet, household_id: household, name: 'Max' }
            : null
          : [],
    error: null,
  });
  const query = {
    select: () => query,
    eq: () => query,
    order: () => Promise.resolve(value()),
    maybeSingle: () => Promise.resolve(value()),
    single: () => Promise.resolve(value()),
  };
  return query;
});
const db = { from, rpc } as unknown as SupabaseClient;
const app = createApp(async () => ({ userId: actor, db }));
const auth = { Authorization: 'Bearer verified-test-token' };
beforeEach(() => {
  role = 'admin';
  visible = true;
  rpc.mockReset();
  from.mockClear();
  rpc.mockResolvedValue({ data: { id: pet }, error: null });
});
describe('PawLog API contracts and authorization (database client stub)', () => {
  it('requires authentication on business endpoints', async () => {
    await request(app).post('/api/households').send({ name: 'Home' }).expect(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('validates route UUIDs before database access', async () => {
    const res = await request(app).get('/api/households/not-a-uuid').set(auth).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(from).not.toHaveBeenCalled();
  });
  it('rejects an extra identity field instead of trusting it', async () => {
    await request(app)
      .post('/api/households')
      .set(auth)
      .send({ name: 'Home', created_by: performer })
      .expect(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('creates households through the atomic RPC without a caller-supplied identity', async () => {
    rpc.mockResolvedValue({ data: household, error: null });
    const res = await request(app)
      .post('/api/households')
      .set(auth)
      .send({ name: ' Home ' })
      .expect(201);
    expect(res.body.data.id).toBe(household);
    expect(rpc).toHaveBeenCalledWith('create_household', { household_name: 'Home' });
  });
  it('denies admin mutations to ordinary members', async () => {
    role = 'member';
    const res = await request(app)
      .post(`/api/households/${household}/pets`)
      .set(auth)
      .send({ name: 'Max', species: 'Dog' })
      .expect(403);
    expect(res.body.error.code).toBe('ADMIN_REQUIRED');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('hides inaccessible households and pets', async () => {
    visible = false;
    await request(app).get(`/api/households/${household}`).set(auth).expect(404);
    await request(app).get(`/api/pets/${pet}`).set(auth).expect(404);
  });
  it('requires an idempotency key', async () => {
    await request(app).post(`/api/pets/${pet}/activities`).set(auth).send(payload()).expect(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects future completions and spoofed logger IDs', async () => {
    await request(app)
      .post(`/api/pets/${pet}/activities`)
      .set(auth)
      .set('Idempotency-Key', key)
      .send({ ...payload(), performed_at: new Date(Date.now() + 600000).toISOString() })
      .expect(400);
    await request(app)
      .post(`/api/pets/${pet}/activities`)
      .set(auth)
      .set('Idempotency-Key', key)
      .send({ ...payload(), logged_by: performer })
      .expect(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('returns 201 for a new activity and 200 for a replay', async () => {
    rpc
      .mockResolvedValueOnce({ data: { log: { id: key }, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: { log: { id: key }, replayed: true }, error: null });
    const body = payload();
    const first = await request(app)
      .post(`/api/pets/${pet}/activities`)
      .set(auth)
      .set('Idempotency-Key', key)
      .send(body)
      .expect(201);
    const retry = await request(app)
      .post(`/api/pets/${pet}/activities`)
      .set(auth)
      .set('Idempotency-Key', key)
      .send(body)
      .expect(200);
    expect(first.body.data.log.id).toBe(retry.body.data.log.id);
    expect(rpc).toHaveBeenCalledWith('log_activity', {
      target_pet: pet,
      target_type: activityType,
      performer,
      completed_at: body.performed_at,
      request_key: key,
      activity_notes: 'Dinner',
      allow_recent: false,
    });
  });
  it('returns structured feeding warnings and forwards explicit confirmation', async () => {
    rpc.mockResolvedValueOnce({
      data: { error: 'RECENT_FEEDING', latest: { performed_by: performer }, warning_minutes: 15 },
      error: null,
    });
    const res = await request(app)
      .post(`/api/pets/${pet}/activities`)
      .set(auth)
      .set('Idempotency-Key', key)
      .send(payload())
      .expect(409);
    expect(res.body.error.details.warning_minutes).toBe(15);
    rpc.mockResolvedValueOnce({ data: { log: { id: key }, replayed: false }, error: null });
    await request(app)
      .post(`/api/pets/${pet}/activities`)
      .set(auth)
      .set('Idempotency-Key', key)
      .send({ ...payload(), allow_recent: true })
      .expect(201);
    expect(rpc.mock.calls.at(-1)?.[1].allow_recent).toBe(true);
  });
  it('returns a distinct conflict for changed idempotent submissions', async () => {
    rpc.mockResolvedValue({ data: { error: 'IDEMPOTENCY_CONFLICT' }, error: null });
    const res = await request(app)
      .post(`/api/pets/${pet}/activities`)
      .set(auth)
      .set('Idempotency-Key', key)
      .send(payload())
      .expect(409);
    expect(res.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });
  it('returns a high-entropy invitation once and passes only its hash to SQL', async () => {
    rpc.mockResolvedValue({ data: key, error: null });
    const res = await request(app)
      .post(`/api/households/${household}/invitations`)
      .set(auth)
      .expect(201);
    expect(res.body.data.code).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(rpc.mock.calls[0]?.[1].invitation_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(res.body.data.code);
    expect(res.headers['cache-control']).toBe('no-store');
  });
  it('reports durable invitation rate limits with retry guidance', async () => {
    rpc.mockResolvedValue({ data: { error: 'RATE_LIMITED' }, error: null });
    const res = await request(app)
      .post('/api/invitations/redeem')
      .set(auth)
      .send({ code: 'a'.repeat(43) })
      .expect(429);
    expect(res.headers['retry-after']).toBe('900');
  });
  it('maps unavailable migrations to a useful error without SQL details', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'private internal detail' },
    });
    const res = await request(app)
      .post('/api/households')
      .set(auth)
      .send({ name: 'Home' })
      .expect(503);
    expect(res.body.error.code).toBe('MIGRATION_REQUIRED');
    expect(JSON.stringify(res.body)).not.toContain('private internal detail');
  });
  it('distinguishes omitted and explicitly removed pet photos', async () => {
    await request(app).patch(`/api/pets/${pet}`).set(auth).send({ name: 'Maximus' }).expect(200);
    expect(rpc.mock.calls[0]?.[1].replace_photo).toBe(false);
    await request(app).patch(`/api/pets/${pet}`).set(auth).send({ photo_url: null }).expect(200);
    expect(rpc.mock.calls[1]?.[1].replace_photo).toBe(true);
  });
  it('normalizes PostgREST composite rows into a single API object', async () => {
    rpc.mockResolvedValue({ data: [{ id: pet, name: 'Max', species: 'Dog' }], error: null });
    const response = await request(app)
      .post(`/api/households/${household}/pets`)
      .set(auth)
      .send({ name: 'Max', species: 'Dog' })
      .expect(201);
    expect(response.body.data.id).toBe(pet);
    expect(Array.isArray(response.body.data)).toBe(false);
  });
  it('rejects caller-selected invitation secrets', async () => {
    await request(app)
      .post(`/api/households/${household}/invitations`)
      .set(auth)
      .send({ code: 'chosen-by-client' })
      .expect(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('validates HTTPS photos, bounded notes, empty patches and warning settings', async () => {
    await request(app)
      .post(`/api/households/${household}/pets`)
      .set(auth)
      .send({ name: 'Max', species: 'Dog', photo_url: 'http://example.com/pet.jpg' })
      .expect(400);
    await request(app).patch(`/api/pets/${pet}`).set(auth).send({}).expect(400);
    await request(app)
      .patch(`/api/households/${household}`)
      .set(auth)
      .send({ feeding_warning_minutes: -1 })
      .expect(400);
    await request(app)
      .post(`/api/pets/${pet}/activities`)
      .set(auth)
      .set('Idempotency-Key', key)
      .send({ ...payload(), notes: 'x'.repeat(281) })
      .expect(400);
  });
  it.each([22, 43])(
  'accepts a %i-character invitation and hashes its exact value',
  async (length) => {
    const code = 'aB_-'.repeat(11).slice(0, length);

    rpc.mockResolvedValue({
      data: { household_id: household },
      error: null,
    });

    const response = await request(app)
      .post('/api/invitations/redeem')
      .set(auth)
      .send({ code: ` ${code} ` })
      .expect(200);

    expect(response.body.data.household_id).toBe(household);
    expect(rpc).toHaveBeenCalledWith(
      'redeem_household_invitation',
      { invitation_hash: hashCode(code) },
    );
  },
);

it.each([
  'a'.repeat(21),
  'a'.repeat(23),
  'a'.repeat(42),
  'a'.repeat(44),
  '!'.repeat(22),
])('rejects an invalid invitation code: %s', async (code) => {
  await request(app)
    .post('/api/invitations/redeem')
    .set(auth)
    .send({ code })
    .expect(400);

  expect(rpc).not.toHaveBeenCalled();
});
});
