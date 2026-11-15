// Real JWTs from the local Supabase Auth service. Set the local keys with
// DROP_TEST_ANON_KEY and DROP_TEST_SERVICE_KEY before running.
import assert from 'node:assert/strict';
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
const civic = at(25.03727, 121.56262);
function distance(lat1, lng1, lat2, lng2) {
  const rad = x => x * Math.PI / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(a));
}
try {
  for (const role of ['sender', 'finder']) {
    const email = `drop-100m-${role}-${name}@example.invalid`;
    const password = randomUUID();
    const user = ok(await request('/auth/v1/admin/users', { method: 'POST', key: service,
      body: { email, password, email_confirm: true, user_metadata: { name: `Drop test ${role}` } } }));
    const person = { id: user.id };
    people.push(person);
    person.jwt = ok(await request('/auth/v1/token?grant_type=password', { method: 'POST',
      body: { email, password } })).access_token;
    const profile = await records('profiles', 'POST', { id: user.id, name: `Drop test ${role}` });
    assert(profile.ok || profile.data?.code === '23505', JSON.stringify(profile.data));
  }
  const [sender, finder] = people;
  const drop = { p_message: 'A letter from Civic Square.', p_hint: '', p_vessel: 'tin', p_drift_days: 1 };
  assert.equal((await rpc(sender.jwt, 'public_capsule_drop', { ...drop, ...at(0, 0) })).data.message, 'no_shore');
  const [capsule] = ok(await rpc(sender.jwt, 'public_capsule_drop', { ...drop, ...civic }));
  const rowPath = `capsules?id=eq.${capsule.id}`;
  const [stored] = ok(await records(rowPath));
  assert(stored.corrupted_drop_spot && !stored.public_capsule_spot);
  ok(await records(rowPath, 'PATCH', { open_at: new Date(Date.now() - 60000).toISOString() }));
  const found = ok(await rpc(finder.jwt, 'public_capsule_nearby', civic)).find(p => p.id === capsule.id);
  const dropDistance = distance(civic.p_lat, civic.p_lng, found.lat, found.lng);
  assert(dropDistance > 0 && dropDistance <= 100);
  const pickup = coords => rpc(finder.jwt, 'public_capsule_pick_up', { p_id: capsule.id, ...coords });
  assert.equal((await pickup(at(found.lat + 150 / 111195, found.lng))).data.message, 'too_far');
  ok(await pickup(at(found.lat + 70 / 111195, found.lng)));
  const [opened] = ok(await rpc(finder.jwt, 'open_capsule', { p_id: capsule.id }));
  assert.equal(opened.message, drop.p_message);
  const started = Date.now();
  ok(await rpc(finder.jwt, 'public_capsule_return', { p_id: capsule.id }));
  const [returned] = ok(await records(rowPath));
  const table = returned.corrupted_drop_spot ? 'corrupted_spots' : 'public_capsule_spots';
  const point = returned.corrupted_drop_spot ?? returned.public_capsule_spot;
  const [destination] = ok(await records(`${table}?id=eq.${point}`));
  const move = distance(found.lat, found.lng, destination.lat, destination.lng);
  assert(move >= 1000);
  assert.equal(destination.city ?? destination.city_en, 'Taipei');
  assert.equal(returned.recipient, null);
  assert.equal(returned.public_capsule_returns, 1);
  assert(Math.abs(new Date(returned.open_at).getTime() - (started + 86400000)) < 5000);
  console.log(`PASS: real JWTs, Civic Square snap ${dropDistance.toFixed(1)} m, 70/150 m pickup, pass-on move ${Math.round(move)} m`);
} finally {
  for (const person of people) {
    if (person.jwt) ok(await request('/auth/v1/logout', { method: 'POST', token: person.jwt }));
    ok(await request(`/auth/v1/admin/users/${person.id}`, { method: 'DELETE', key: service }));
  }
}
