// Optional real multi-connection PostgreSQL tests. Uses a new disposable cluster only.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
const root = mkdtempSync('/tmp/pawlog-pg-');
const dataDir = join(root, 'data');
const server = createServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
await new Promise((resolve) => server.close(resolve));
const ctl = process.env.PAWLOG_PG_CTL ?? 'pg_ctl';
const init = process.env.PAWLOG_INITDB ?? 'initdb';
const psql = process.env.PAWLOG_PSQL ?? 'psql';
let started = false;
function query(sql, onResult) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      psql,
      [
        '-X',
        '-q',
        '-A',
        '-t',
        '-v',
        'ON_ERROR_STOP=1',
        '-h',
        '127.0.0.1',
        '-p',
        String(port),
        '-U',
        'pawlog_test',
        '-d',
        'postgres',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let output = '',
      error = '';
    let notified = false;
    child.stdout.on('data', (chunk) => {
      output += chunk;
      if (!notified && output.includes('"replayed"')) {
        notified = true;
        onResult?.();
      }
    });
    child.stderr.on('data', (chunk) => (error += chunk));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve(output.trim()) : reject(new Error(error || `psql exited ${code}`)),
    );
    child.stdin.end(sql);
  });
}
const actor = '00000000-0000-4000-8000-000000000001',
  member = '00000000-0000-4000-8000-000000000002',
  outsider = '00000000-0000-4000-8000-000000000003',
  outsider2 = '00000000-0000-4000-8000-000000000004';
const begin = (id) =>
  `begin;set local "request.jwt.claim.sub"='${id}';set local role authenticated;`;
const parse = (output) => JSON.parse(output.split('\n').find((line) => line.startsWith('{')));
try {
  execFileSync(
    init,
    ['-D', dataDir, '--username=pawlog_test', '--auth=trust', '--no-locale', '--encoding=UTF8'],
    { stdio: 'pipe' },
  );
  execFileSync(
    ctl,
    [
      '-D',
      dataDir,
      '-l',
      join(root, 'server.log'),
      '-o',
      `-p ${port} -h 127.0.0.1 -k ${root}`,
      '-w',
      'start',
    ],
    { stdio: 'pipe' },
  );
  started = true;
  await query(`create role anon nologin;create role authenticated nologin;create schema auth;grant usage on schema auth,public to authenticated;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant execute on function auth.uid() to authenticated;`);
  for (const filename of ['20261016000100_foundation.sql', '20261016000200_api_operations.sql'])
    await query(
      readFileSync(new URL(`../supabase/migrations/${filename}`, import.meta.url), 'utf8'),
    );
  await query(
    `insert into auth.users(id) values('${actor}'),('${member}'),('${outsider}'),('${outsider2}');`,
  );
  const household = (
    await query(`${begin(actor)}select public.create_household('Concurrency test');commit;`)
  ).split('\n')[0];
  await query(
    `insert into public.household_members(household_id,user_id) values('${household}','${member}');`,
  );
  const pet = (
    await query(`${begin(actor)}select (public.create_pet('${household}','Max','Dog')).id;commit;`)
  ).split('\n')[0];
  const walking = (
    await query(
      `select id from public.activity_types where household_id='${household}' and key='walking';`,
    )
  ).split('\n')[0];
  const feeding = (
    await query(
      `select id from public.activity_types where household_id='${household}' and key='feeding';`,
    )
  ).split('\n')[0];
  const time = new Date(Date.now() - 60000).toISOString();
  const call = (type, user, key) =>
    `select public.log_activity('${pet}','${type}','${user}','${time}','${key}');`;
  // Hold transaction A open after insertion. B must wait and then replay the same row.
  const key = '10000000-0000-4000-8000-000000000001';
  let firstReady;
  const ready = new Promise((resolve) => (firstReady = resolve));
  const first = query(
    `${begin(actor)}${call(walking, actor, key)}select pg_sleep(0.3);commit;`,
    firstReady,
  );
  await Promise.race([ready, first]);
  const second = query(`${begin(actor)}${call(walking, actor, key)}commit;`);
  const [a, b] = await Promise.all([first, second]);
  assert.equal(parse(a).log.id, parse(b).log.id);
  assert.equal(parse(b).replayed, true);
  assert.equal(
    await query(`select count(*) from public.activity_logs where idempotency_key='${key}';`),
    '1',
  );
  console.log('PASS: concurrent identical submissions create one row and replay it.');
  // Different members share the pet lock before the recent-feeding check.
  let feedingReady;
  const fReady = new Promise((resolve) => (feedingReady = resolve));
  const f1 = query(
    `${begin(actor)}${call(feeding, actor, '10000000-0000-4000-8000-000000000002')}select pg_sleep(0.3);commit;`,
    feedingReady,
  );
  await Promise.race([fReady, f1]);
  const f2 = query(
    `${begin(member)}${call(feeding, member, '10000000-0000-4000-8000-000000000003')}commit;`,
  );
  const [fa, fb] = await Promise.all([f1, f2]);
  assert.equal(parse(fa).replayed, false);
  assert.equal(parse(fb).error, 'RECENT_FEEDING');
  assert.equal(
    await query(`select count(*) from public.activity_logs where activity_type_id='${feeding}';`),
    '1',
  );
  console.log('PASS: competing household feedings yield one insert and one warning.');
  // The invitation row is locked before either request adds its member.
  const hash = 'a'.repeat(64);
  await query(
    `${begin(actor)}select public.create_household_invitation('${household}','${hash}');commit;`,
  );
  const results = await Promise.all(
    [outsider, outsider2].map((user) =>
      query(`${begin(user)}select public.redeem_household_invitation('${hash}');commit;`),
    ),
  );
  const parsed = results.map(parse);
  assert.equal(parsed.filter((result) => result.household_id === household).length, 1);
  assert.equal(parsed.filter((result) => result.error === 'INVALID_INVITATION').length, 1);
  assert.equal(
    await query(
      `select count(*) from public.household_members where household_id='${household}' and user_id in ('${outsider}','${outsider2}');`,
    ),
    '1',
  );
  console.log('PASS: concurrent invitation redemptions admit exactly one member.');
} catch (error) {
  console.error(
    'Concurrent PostgreSQL checks could not run:',
    error.stderr?.toString().trim() || error.message,
  );
  process.exitCode = 1;
} finally {
  if (started)
    execFileSync(ctl, ['-D', dataDir, '-m', 'immediate', '-w', 'stop'], { stdio: 'pipe' });
  rmSync(root, { recursive: true, force: true });
}
