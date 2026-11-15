// Real JWTs from the local Supabase Auth service. Set the local keys with
// DROP_TEST_ANON_KEY and DROP_TEST_SERVICE_KEY before running.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const base = 'http://127.0.0.1:54321';
const { DROP_TEST_ANON_KEY: anon, DROP_TEST_SERVICE_KEY: service } = process.env;
assert(anon && service, 'Set local Supabase test keys');

async function request(path, { method = 'GET', key = anon, token = key, body } = {}) {
  const response = await fetch(base + path, { method,
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  return { ok: response.ok, data: raw ? JSON.parse(raw) : null };
}
function ok(result) {
  assert(result.ok, JSON.stringify(result.data));
  return result.data;
}
const name = randomUUID();
const people = [];
const at = (p_lat, p_lng) => ({ p_lat, p_lng, p_accuracy: 10 });
const rpc = (token, fn, body) => request('/rest/v1/rpc/' + fn, { method: 'POST', token, body });
const records = (path, method = 'GET', body) => request('/rest/v1/' + path, { method, key: service, body });
const sidewalk = at(25.05757, 121.52067);
const school = at(25.0303057, 121.5470257);
const sql = statement => execFileSync('docker', [
  'exec', '-i', 'supabase_db_time-capsule', 'psql', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1',
], { input: statement, encoding: 'utf8' }).trim();
function distance(lat1, lng1, lat2, lng2) {
  const rad = x => x * Math.PI / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(a));
}
try {
  for (const role of ['sender', 'finder', 'second reporter', 'moderator']) {
    const email = `drop-places-${role.replaceAll(' ', '-')}-${name}@example.invalid`;
    const password = randomUUID();
    const user = ok(await request('/auth/v1/admin/users', { method: 'POST', key: service,
      body: { email, password, email_confirm: true, user_metadata: { name: `Drop test ${role}` } } }));
    const person = { id: user.id, role };
    people.push(person);
    person.jwt = ok(await request('/auth/v1/token?grant_type=password', { method: 'POST',
      body: { email, password } })).access_token;
    const profile = await records('profiles', 'POST', { id: user.id, name: `Drop test ${role}` });
    assert(profile.ok || profile.data?.code === '23505', JSON.stringify(profile.data));
  }
  const [sender, finder, second, moderator] = people;
  sql(`insert into private.admin_members(user_id,role) values ('${moderator.id}', 'moderator');`);
  const drop = { p_message: 'A letter from the sidewalk.', p_hint: '', p_vessel: 'tin', p_drift_days: 1 };
  assert.equal((await rpc(sender.jwt, 'public_capsule_drop', { ...drop, ...at(0, 0) })).data.message, 'no_shore');
  assert.equal((await rpc(sender.jwt, 'public_capsule_drop', { ...drop, ...school })).data.message, 'no_shore');
  const dropStarted = performance.now();
  const [capsule] = ok(await rpc(sender.jwt, 'public_capsule_drop', { ...drop, ...sidewalk }));
  const dropMs = performance.now() - dropStarted;
  const rowPath = `capsules?id=eq.${capsule.id}`;
  const [stored] = ok(await records(rowPath));
  assert(stored.public_capsule_drop_place && !stored.public_capsule_spot && !stored.corrupted_drop_spot);
  ok(await records(rowPath, 'PATCH', { open_at: new Date(Date.now() - 60000).toISOString() }));
  const found = ok(await rpc(finder.jwt, 'public_capsule_nearby', sidewalk)).find(p => p.id === capsule.id);
  const dropDistance = distance(sidewalk.p_lat, sidewalk.p_lng, found.lat, found.lng);
  assert(dropDistance > 0 && dropDistance <= 100);
  const pickup = coords => rpc(finder.jwt, 'public_capsule_pick_up', { p_id: capsule.id, ...coords });
  assert.equal((await pickup(at(found.lat + 150 / 111195, found.lng))).data.message, 'too_far');
  ok(await pickup(at(found.lat + 70 / 111195, found.lng)));
  const [opened] = ok(await rpc(finder.jwt, 'open_capsule', { p_id: capsule.id }));
  assert.equal(opened.message, drop.p_message);
  const started = Date.now();
  ok(await rpc(finder.jwt, 'public_capsule_return', { p_id: capsule.id }));
  const [returned] = ok(await records(rowPath));
  const destination = JSON.parse(sql(`select row_to_json(s) from (
    select p.lat, p.lng, p.city_en from private.public_capsule_points p
    join public.capsules c on p.id = coalesce(c.public_capsule_spot, c.corrupted_drop_spot, c.public_capsule_drop_place)
      and p.corrupted = (c.corrupted_drop_spot is not null)
      and p.drop_place = (c.public_capsule_drop_place is not null)
    where c.id = '${capsule.id}'
  ) s;`));
  const move = distance(found.lat, found.lng, destination.lat, destination.lng);
  assert(move >= 1000);
  assert.equal(destination.city ?? destination.city_en, 'Taipei');
  assert.equal(returned.recipient, null);
  assert.equal(returned.public_capsule_returns, 1);
  assert(Math.abs(new Date(returned.open_at).getTime() - (started + 86400000)) < 5000);
  const [reported] = ok(await rpc(sender.jwt, 'public_capsule_drop', { ...drop, ...sidewalk }));
  const reportPath = `capsules?id=eq.${reported.id}`;
  ok(await records(reportPath, 'PATCH', { open_at: new Date(Date.now() - 60000).toISOString() }));
  for (const reporter of [finder, second]) {
    ok(await rpc(reporter.jwt, 'public_capsule_pick_up', { p_id: reported.id, ...sidewalk }));
    ok(await rpc(reporter.jwt, 'open_capsule', { p_id: reported.id }));
    ok(await rpc(reporter.jwt, 'public_capsule_report', { p_id: reported.id, p_reason: 'other' }));
  }
  assert(!ok(await rpc(moderator.jwt, 'public_capsule_nearby', sidewalk)).some(item => item.id === reported.id));
  assert.equal((await rpc(moderator.jwt, 'public_capsule_pick_up', { p_id: reported.id, ...sidewalk })).data.message, 'taken');
  const resolve = decision => rpc(moderator.jwt, 'admin_queue_resolve', {
    p_kind: 'public_capsule_report', p_id: reported.id, p_decision: decision, p_note: null,
  });
  ok(await resolve('restore'));
  ok(await rpc(moderator.jwt, 'public_capsule_pick_up', { p_id: reported.id, ...sidewalk }));
  ok(await rpc(moderator.jwt, 'open_capsule', { p_id: reported.id }));
  sql(`insert into public.public_capsule_reports(capsule_id,reporter,reason)
    values ('${reported.id}', '${moderator.id}', 'other');`);
  ok(await resolve('remove'));
  const inbox = ok(await request('/rest/v1/' + reportPath, { token: moderator.jwt }));
  assert.equal(inbox.length, 0);
  console.log(`PASS: real JWTs, sidewalk snap ${dropDistance.toFixed(1)} m in ${dropMs.toFixed(1)} ms HTTP, school refusal, 70/150 m pickup, pass-on move ${Math.round(move)} m, two-report hide and admin Remove`);
} finally {
  for (const person of people) {
    if (person.jwt) ok(await request('/auth/v1/logout', { method: 'POST', token: person.jwt }));
    if (person.role === 'moderator') {
      sql(`delete from private.admin_members where user_id = '${person.id}';`);
    }
    ok(await request(`/auth/v1/admin/users/${person.id}`, { method: 'DELETE', key: service }));
  }
}
