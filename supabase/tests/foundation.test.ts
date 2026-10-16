import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
const eric = '00000000-0000-4000-8000-000000000001',
  sarah = '00000000-0000-4000-8000-000000000002',
  alex = '00000000-0000-4000-8000-000000000003';
let db: PGlite;
let a: string;
let b: string;
async function user(id: string) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec('set role authenticated');
}
async function scalar(sql: string, args: unknown[] = []) {
  return Object.values((await db.query<Record<string, unknown>>(sql, args)).rows[0]!)[0];
}
async function denied(sql: string, args: unknown[] = []) {
  await db.exec('savepoint denied');
  try {
    await expect(db.query(sql, args)).rejects.toThrow();
  } finally {
    await db.exec('rollback to denied');
  }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth; grant usage on schema auth,public to authenticated;
 create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant execute on function auth.uid() to authenticated;`);
  await db.exec(
    await readFile(new URL('../migrations/20261016000100_foundation.sql', import.meta.url), 'utf8'),
  );
  await db.exec(
    await readFile(
      new URL('../migrations/20261016000200_api_operations.sql', import.meta.url),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL('../migrations/20261016000300_care_realtime.sql', import.meta.url),
      'utf8',
    ),
  );
  for (const [id, name] of [
    [eric, 'Eric'],
    [sarah, 'Sarah'],
    [alex, 'Alex'],
  ])
    await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [
      id,
      JSON.stringify({ display_name: name }),
    ]);
  await user(eric);
  a = (await scalar("select public.create_household('A')")) as string;
  await user(alex);
  b = (await scalar("select public.create_household('B')")) as string;
  await db.exec('reset role');
  await db.query('insert into public.household_members(household_id,user_id) values($1,$2)', [
    a,
    sarah,
  ]);
}, 30000);
beforeEach(async () => {
  await db.exec('begin');
  await user(eric);
});
afterEach(async () => {
  await db.exec('rollback;reset role');
});
afterAll(async () => {
  await db?.close();
});
describe('PostgreSQL household isolation', () => {
  it('creates profiles, admin membership and four default activity types', async () => {
    expect(await scalar('select display_name from public.profiles where id=$1', [eric])).toBe(
      'Eric',
    );
    expect(await scalar('select role from public.household_members where user_id=$1', [eric])).toBe(
      'admin',
    );
    expect(await scalar('select count(*)::int from public.activity_types')).toBe(4);
  });
  it('restricts household, member and profile reads to shared households', async () => {
    expect(await scalar('select count(*)::int from public.households')).toBe(1);
    expect(await scalar('select count(*)::int from public.households where id=$1', [b])).toBe(0);
    expect(await scalar('select count(*)::int from public.household_members')).toBe(2);
    expect(await scalar('select count(*)::int from public.profiles')).toBe(2);
    expect(await scalar('select count(*)::int from public.profiles where id=$1', [alex])).toBe(0);
  });
  it('denies direct writes, role escalation and invitation hash access', async () => {
    await denied("update public.household_members set role='admin' where user_id=$1", [sarah]);
    await denied("insert into public.households(name,created_by) values('Bypass',$1)", [eric]);
    await denied('select * from public.household_invitations');
    await denied('select * from private.invitation_attempts');
    await denied('delete from public.activity_logs');
  });
  it('allows only admins to create household invitations', async () => {
    await user(sarah);
    await denied('select public.create_household_invitation($1,$2)', [a, 'a'.repeat(64)]);
    await user(alex);
    await denied('select public.create_household_invitation($1,$2)', [a, 'a'.repeat(64)]);
  });
  it('redeems an invitation once and grants only member status', async () => {
    await db.query('select public.create_household_invitation($1,$2)', [a, 'b'.repeat(64)]);
    await user(alex);
    expect(await scalar('select public.redeem_household_invitation($1)', ['b'.repeat(64)])).toEqual(
      { household_id: a },
    );
    expect(
      await scalar(
        'select role from public.household_members where household_id=$1 and user_id=$2',
        [a, alex],
      ),
    ).toBe('member');
    expect(await scalar('select public.redeem_household_invitation($1)', ['b'.repeat(64)])).toEqual(
      { error: 'INVALID_INVITATION' },
    );
  });
  it('rejects expired invitations', async () => {
    await db.query('select public.create_household_invitation($1,$2)', [a, 'c'.repeat(64)]);
    await db.exec('reset role');
    await db.query(
      "update public.household_invitations set created_at=now()-interval '4 days', expires_at=now()-interval '2 days'",
    );
    await user(alex);
    expect(await scalar('select public.redeem_household_invitation($1)', ['c'.repeat(64)])).toEqual(
      { error: 'INVALID_INVITATION' },
    );
  });
  it('rate limits failed redemptions with committed counters', async () => {
    for (let i = 0; i < 10; i++)
      expect(
        await scalar('select public.redeem_household_invitation($1)', ['d'.repeat(64)]),
      ).toEqual({ error: 'INVALID_INVITATION' });
    expect(await scalar('select public.redeem_household_invitation($1)', ['d'.repeat(64)])).toEqual(
      { error: 'RATE_LIMITED' },
    );
  });
  it('updates only the current profile and rejects blank names', async () => {
    await db.query("select public.update_profile('Eric V')");
    expect(await scalar('select display_name from public.profiles where id=$1', [eric])).toBe(
      'Eric V',
    );
    expect(await scalar('select display_name from public.profiles where id=$1', [sarah])).toBe(
      'Sarah',
    );
    await denied("select public.update_profile('  ')");
  });
  it('enforces household foreign keys, idempotency uniqueness and pet/log isolation', async () => {
    await db.exec('reset role');
    const pet = await scalar(
      "insert into public.pets(household_id,name,species) values($1,'Max','Dog') returning id",
      [a],
    );
    const typeA = await scalar(
      'select id from public.activity_types where household_id=$1 limit 1',
      [a],
    );
    const typeB = await scalar(
      'select id from public.activity_types where household_id=$1 limit 1',
      [b],
    );
    const sql =
      'insert into public.activity_logs(household_id,pet_id,activity_type_id,performed_by,logged_by,performed_at,idempotency_key) values($1,$2,$3,$4,$5,now(),$6)';
    const key = '10000000-0000-4000-8000-000000000001';
    await denied(sql, [a, pet, typeB, eric, eric, key]);
    await denied(sql, [a, pet, typeA, alex, eric, key]);
    await db.query(sql, [a, pet, typeA, sarah, eric, key]);
    await denied(sql, [a, pet, typeA, sarah, eric, key]);
    await user(alex);
    expect(await scalar('select count(*)::int from public.activity_logs')).toBe(0);
    expect(await scalar('select count(*)::int from public.pets')).toBe(0);
  });

  async function newPet() {
    return (await scalar("select (public.create_pet($1,'Max','Dog')).id", [a])) as string;
  }
  async function typeId(key = 'feeding', household = a) {
    return (await scalar('select id from public.activity_types where household_id=$1 and key=$2', [
      household,
      key,
    ])) as string;
  }
  async function log(
    pet: string,
    type: string,
    performer = eric,
    time = new Date(Date.now() - 60000).toISOString(),
    requestKey = crypto.randomUUID(),
    note = '',
    override = false,
  ) {
    return (await scalar('select public.log_activity($1,$2,$3,$4,$5,$6,$7)', [
      pet,
      type,
      performer,
      time,
      requestKey,
      note,
      override,
    ])) as {
      error?: string;
      log: { id: string; performed_by: string; logged_by: string; notes: string };
      replayed: boolean;
    };
  }
  it('lets only admins create pets and edit household information', async () => {
    const pet = await newPet();
    expect(await scalar('select name from public.pets where id=$1', [pet])).toBe('Max');
    await user(sarah);
    await denied("select public.create_pet($1,'Luna','Cat')", [a]);
    await denied("select public.update_household($1,'Renamed',10)", [a]);
    await denied("select public.update_pet($1,'Renamed')", [pet]);
    await user(eric);
    await db.query("select public.update_household($1,'Our home',20)", [a]);
    expect(
      await scalar('select feeding_warning_minutes from public.households where id=$1', [a]),
    ).toBe(20);
  });
  it('supports pet photo removal without overwriting omitted fields', async () => {
    const pet = await newPet();
    await db.query('select public.update_pet($1,null,null,$2,true)', [
      pet,
      'https://example.com/pet.png',
    ]);
    await db.query("select public.update_pet($1,'Maximus')", [pet]);
    expect(await scalar('select photo_url from public.pets where id=$1', [pet])).toBe(
      'https://example.com/pet.png',
    );
    await db.query('select public.update_pet($1,null,null,null,true)', [pet]);
    expect(await scalar('select photo_url from public.pets where id=$1', [pet])).toBe(null);
  });
  it('records the actual performer separately from the authenticated logger', async () => {
    const pet = await newPet();
    const type = await typeId();
    const result = await log(pet, type, sarah);
    expect(result.log.performed_by).toBe(sarah);
    expect(result.log.logged_by).toBe(eric);
    expect(
      await scalar('select count(*)::int from public.activity_logs where pet_id=$1', [pet]),
    ).toBe(1);
  });
  it('replays a request without another row and rejects changed payloads', async () => {
    const pet = await newPet();
    const type = await typeId();
    const key = crypto.randomUUID();
    const time = new Date(Date.now() - 60000).toISOString();
    const first = await log(pet, type, eric, time, key, ' dinner ');
    const retry = await log(pet, type, eric, time, key, 'dinner');
    expect(retry.replayed).toBe(true);
    expect(retry.log.id).toBe(first.log.id);
    expect((await log(pet, type, sarah, time, key, 'dinner')).error).toBe('IDEMPOTENCY_CONFLICT');
    expect(
      await scalar('select count(*)::int from public.activity_logs where pet_id=$1', [pet]),
    ).toBe(1);
  });
  it('warns about a recent feeding and requires explicit override', async () => {
    const pet = await newPet();
    const type = await typeId();
    await log(pet, type);
    const key = crypto.randomUUID();
    const time = new Date(Date.now() - 30000).toISOString();
    expect((await log(pet, type, sarah, time, key)).error).toBe('RECENT_FEEDING');
    expect(
      await scalar('select count(*)::int from public.activity_logs where pet_id=$1', [pet]),
    ).toBe(1);
    expect((await log(pet, type, sarah, time, key, '', true)).replayed).toBe(false);
    expect(
      await scalar('select count(*)::int from public.activity_logs where pet_id=$1', [pet]),
    ).toBe(2);
  });
  it('permits recent feeding when the admin disables the warning', async () => {
    const pet = await newPet();
    const type = await typeId();
    await log(pet, type);
    await db.query('select public.update_household($1,null,0)', [a]);
    expect((await log(pet, type)).error).toBeUndefined();
  });
  it('returns all active types with null empty states and the newest completion', async () => {
    const pet = await newPet();
    const type = await typeId('walking');
    const latest = await log(pet, type);
    await log(pet, type, sarah, new Date(Date.now() - 86400000).toISOString());
    const dashboard = (await scalar('select public.latest_activities($1)', [pet])) as {
      activity_type: { key: string };
      latest: { id: string; performed_by_name: string } | null;
    }[];
    expect(dashboard).toHaveLength(4);
    expect(dashboard.find((row) => row.activity_type.key === 'walking')?.latest?.id).toBe(
      latest.log.id,
    );
    expect(
      dashboard.find((row) => row.activity_type.key === 'walking')?.latest?.performed_by_name,
    ).toBe('Eric');
    expect(dashboard.find((row) => row.activity_type.key === 'feeding')?.latest).toBeNull();
    expect(
      await scalar('select count(*)::int from public.activity_logs where pet_id=$1', [pet]),
    ).toBe(2);
  });
  it('rejects cross-household performers, activity types and pet access in the RPC', async () => {
    const pet = await newPet();
    const type = await typeId();
    const other = await (async () => {
      await db.exec('reset role');
      const id = await scalar(
        'select id from public.activity_types where household_id=$1 limit 1',
        [b],
      );
      await user(eric);
      return id;
    })();
    const time = new Date(Date.now() - 60000).toISOString();
    await denied('select public.log_activity($1,$2,$3,$4,$5)', [
      pet,
      type,
      alex,
      time,
      crypto.randomUUID(),
    ]);
    await denied('select public.log_activity($1,$2,$3,$4,$5)', [
      pet,
      other,
      eric,
      time,
      crypto.randomUUID(),
    ]);
    await user(alex);
    await denied('select public.latest_activities($1)', [pet]);
    await denied('select public.log_activity($1,$2,$3,$4,$5)', [
      pet,
      type,
      alex,
      time,
      crypto.randomUUID(),
    ]);
  });
  it('rejects future/infinite times, inactive types, and oversized notes in the database', async () => {
    const pet = await newPet();
    const type = await typeId();
    for (const time of [new Date(Date.now() + 600000).toISOString(), 'infinity'])
      await denied('select public.log_activity($1,$2,$3,$4,$5)', [
        pet,
        type,
        eric,
        time,
        crypto.randomUUID(),
      ]);
    await denied('select public.log_activity($1,$2,$3,now(),$4,$5)', [
      pet,
      type,
      eric,
      crypto.randomUUID(),
      'x'.repeat(281),
    ]);
    await db.exec('reset role');
    await db.query('update public.activity_types set is_active=false where id=$1', [type]);
    await user(eric);
    await denied('select public.log_activity($1,$2,$3,now(),$4)', [
      pet,
      type,
      eric,
      crypto.randomUUID(),
    ]);
  });
  it('denies anonymous execution of the new mutation functions', async () => {
    const pet = await newPet();
    await db.exec('reset role;set role anon');
    await denied("select public.create_pet($1,'Max','Dog')", [a]);
    await denied('select public.latest_activities($1)', [pet]);
  });
  it('adds only activity logs to the realtime publication and can rerun safely', async () => {
    await db.exec('reset role');
    await db.exec(
      await readFile(
        new URL('../migrations/20261016000300_care_realtime.sql', import.meta.url),
        'utf8',
      ),
    );
    expect(
      await scalar(
        "select count(*)::int from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='activity_logs'",
      ),
    ).toBe(1);
    expect(
      await scalar(
        "select count(*)::int from pg_publication_tables where pubname='supabase_realtime' and tablename='household_invitations'",
      ),
    ).toBe(0);
    await db.exec('set role anon');
    await denied('select * from public.activity_logs');
  });
  it('loads repeatable local fixtures without reusable passwords', async () => {
    await db.exec('reset role');
    const seed = await readFile(new URL('../seed.sql', import.meta.url), 'utf8');
    await db.exec(seed);
    await db.exec(seed);
    expect(
      await scalar(
        "select count(*)::int from public.households where name='Local sample household'",
      ),
    ).toBe(1);
    expect(await scalar("select count(*)::int from public.pets where name='Max'")).toBe(1);
  });
  it('denies anonymous table access and RPC execution', async () => {
    await db.exec('reset role;set role anon');
    await denied('select * from public.households');
    await denied("select public.create_household('Anonymous')");
  });
});
