// Run against the existing local Time Capsule stack with the rack migration loaded.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const local = 'http://127.0.0.1:54321';
const { RACK_TEST_ANON_KEY: anon, RACK_TEST_SERVICE_KEY: service } = process.env;
assert(anon && service, 'Set the local Supabase test keys');
const psql = ['exec', '-i', 'supabase_db_time-capsule', 'psql', '-U', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1'];
const sql = statement => execFileSync('docker', psql, { input: statement, encoding: 'utf8' }).trim();
const run = randomUUID();
const people = [];
const post = JSON.parse(sql(`
  select json_build_object('id', id, 'lat', lat, 'lng', lng)
  from public.public_capsule_spots where kind = 'common' and game_enabled and hidden_at is null
  order by id limit 1;`));
const location = { lat: post.lat, lng: post.lng, accuracy: 10 };

async function request(path, { method = 'GET', key = anon, token = key, body } = {}) {
  const response = await fetch(local + path, {
    method, headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  return { status: response.status, ok: response.ok, data: raw ? JSON.parse(raw) : null };
}
function ok(result) {
  assert(result.ok, JSON.stringify(result.data));
  return result.data;
}
async function error(response, expected) {
  const result = await response;
  assert(!result.ok);
  assert.equal(result.data.message, expected);
}
const rpc = (token, fn, body) => request('/rest/v1/rpc/' + fn, { method: 'POST', token, body });
const leave = { waypost_id: post.id, ...location, body: 'Only one reader.', hint: 'A small hint', wait_days: 1,
  lock_question: 'Which city?', lock_answer: ' New York ' };

try {
  for (const role of ['sender', 'finder-a', 'finder-b']) {
    const email = `rack-${run}-${role}@example.invalid`;
    const password = randomUUID();
    const user = ok(await request('/auth/v1/admin/users', { method: 'POST', key: service,
      body: { email, password, email_confirm: true, user_metadata: { name: `Rack test ${role}` } } }));
    const person = { id: user.id };
    people.push(person);
    person.jwt = ok(await request('/auth/v1/token?grant_type=password', { method: 'POST',
      body: { email, password } })).access_token;
    const profile = await request('/rest/v1/profiles', { method: 'POST', key: service,
      body: { id: user.id, name: `Rack test ${role}` } });
    assert(profile.ok || profile.data?.code === '23505', JSON.stringify(profile.data));
  }
  const [sender, finder, other] = people;
  assert(!(await rpc(undefined, 'waypost_rack', { waypost_id: post.id })).ok);
  await error(rpc(sender.jwt, 'rack_leave', { ...leave, lock_question: 'Go Die?' }), 'blocked_words');
  const { capsule_id } = ok(await rpc(sender.jwt, 'rack_leave', leave));
  const list = ok(await rpc(finder.jwt, 'waypost_rack', { waypost_id: post.id, filter: 'has_question' }));
  const item = list.items.find(row => row.capsule_id === capsule_id);
  assert.equal(item.lock_question, leave.lock_question);
  assert(!Object.hasOwn(item, 'lock_answer') && !Object.hasOwn(item, 'body'));
  for (const player of people) {
    const result = await request(`/rest/v1/capsule_contents?capsule_id=eq.${capsule_id}&select=lock_answer,message`,
      { token: player.jwt });
    assert(!result.ok || result.data.length === 0);
    await error(rpc(player.jwt, 'open_capsule', { p_id: capsule_id }), 'capsule not found');
  }
  const args = { capsule_id, ...location, answer: ' neW   YORK ' };
  await error(rpc(finder.jwt, 'rack_open', { ...args, accuracy: 201 }), 'too_far');
  await error(rpc(finder.jwt, 'rack_open', args), 'too_early');
  sql(`update public.capsules set open_at = now() - interval '1 minute' where id = '${capsule_id}';`);
  await error(rpc(finder.jwt, 'rack_open', { ...args, answer: 'Los Angeles' }), 'wrong_answer');

  // Take the row lock first, then release it only after both HTTP requests
  // are observed waiting inside Postgres.
  const blocker = spawn('docker', psql, { stdio: ['pipe', 'pipe', 'inherit'] });
  const done = new Promise((resolve, reject) => {
    blocker.once('error', reject);
    blocker.once('close', code => code === 0 ? resolve() : reject(new Error(`psql exit ${code}`)));
  });
  try {
    blocker.stdin.write(`begin; select 1 from public.capsules where id = '${capsule_id}' for update;\n`);
    await new Promise((resolve, reject) => {
      blocker.stdout.once('data', resolve);
      blocker.once('close', () => reject(new Error('Row-lock session closed early')));
    });
    const opening = Promise.all([rpc(finder.jwt, 'rack_open', args), rpc(other.jwt, 'rack_open', args)]);
    let waiters = 0;
    for (let i = 0; i < 50 && waiters < 2; i++) {
      waiters = Number(sql(`select count(*) from pg_stat_activity
        where wait_event_type = 'Lock' and query like '%rack_open%' and pid <> pg_backend_pid();`));
      if (waiters < 2) await delay(50);
    }
    blocker.stdin.end('rollback;\n');
    const results = await opening;
    assert.equal(waiters, 2, 'both opening requests must wait on the capsule row');
    assert.equal(results.filter(result => result.ok).length, 1);
    const winner = results[0].ok ? finder : other;
    const loser = results[0].ok ? other : finder;
    const winningResult = results.find(result => result.ok).data;
    assert.equal(winningResult.message, leave.body);
    assert(!Object.hasOwn(winningResult, 'lock_answer'));
    assert.equal(results.find(result => !result.ok).data.message, 'taken');
    assert.equal(ok(await rpc(winner.jwt, 'open_capsule', { p_id: capsule_id }))[0].message, leave.body);
    await error(rpc(loser.jwt, 'open_capsule', { p_id: capsule_id }), 'capsule not found');
    const inbox = ok(await request(`/rest/v1/capsules?id=eq.${capsule_id}&select=recipient,opened_at`,
      { token: winner.jwt }));
    assert.equal(inbox[0].recipient, winner.id);
    assert(inbox[0].opened_at);
    assert(!ok(await rpc(loser.jwt, 'waypost_rack', { waypost_id: post.id })).items
      .some(row => row.capsule_id === capsule_id));
  } finally {
    if (!blocker.stdin.destroyed && !blocker.stdin.writableEnded) blocker.stdin.end('rollback;\n');
    await done;
  }

  const legacy = { p_message: 'Old app letter', p_hint: '', p_vessel: 'tin', p_drift_days: 1,
    p_lat: post.lat, p_lng: post.lng, p_accuracy: 10 };
  const [old] = ok(await rpc(sender.jwt, 'sea_throw', legacy));
  assert(old.id);
  assert.deepEqual(ok(await rpc(other.jwt, 'public_capsule_nearby',
    { p_lat: post.lat, p_lng: post.lng, p_accuracy: 10 })), []);
  await error(rpc(other.jwt, 'sea_return', { p_id: old.id }), 'not_allowed');
  console.log('PASS: real JWTs, sealed content, early/far/wrong answer, two simultaneous openers and legacy wrappers');
} finally {
  const cleanup = await Promise.allSettled(people.map(async person => {
    try {
      if (person.jwt) ok(await request('/auth/v1/logout', { method: 'POST', token: person.jwt }));
    } finally {
      ok(await request(`/auth/v1/admin/users/${person.id}`, { method: 'DELETE', key: service }));
    }
  }));
  for (const result of cleanup) if (result.status === 'rejected') throw result.reason;
  assert.equal(sql(`select count(*) from auth.users where email like 'rack-${run}-%';`), '0');
  if (people.length) {
    const ids = people.map(person => `'${person.id}'`).join(',');
    assert.equal(sql(`select count(*) from public.capsules where sender in (${ids}) or recipient in (${ids});`), '0');
  }
  console.log('PASS: zero local disposable accounts and capsules remain');
}
