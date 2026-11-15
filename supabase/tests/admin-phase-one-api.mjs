// Real-JWT smoke test. Run only against the local Supabase test stack with A1 loaded.
// ADMIN_A1_ANON_KEY, ADMIN_A1_SERVICE_KEY, ADMIN_A1_OWNER_EMAIL and
// ADMIN_A1_OWNER_PASSWORD come from the local stack and seeded local Roy account.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const api = 'http://127.0.0.1:54321';
const { ADMIN_A1_ANON_KEY: anon, ADMIN_A1_SERVICE_KEY: service,
  ADMIN_A1_OWNER_EMAIL: ownerEmail, ADMIN_A1_OWNER_PASSWORD: ownerPassword } = process.env;
assert(anon && service && ownerEmail && ownerPassword, 'Set local test credentials');

async function request(path, { method = 'GET', key = anon, token = key, body } = {}) {
  const response = await fetch(api + path, {
    method, headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  return { ok: response.ok, status: response.status, data: raw ? JSON.parse(raw) : null };
}

function ok(result) {
  assert(result.ok, JSON.stringify(result.data));
  return result.data;
}
async function signIn(email, password) {
  return ok(await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })).access_token;
}
const owner = await signIn(ownerEmail, ownerPassword);
const rpc = (token, name, body = {}) =>
  request(`/rest/v1/rpc/admin_${name}`, { method: 'POST', token, body });
const insert = (table, body) =>
  request(`/rest/v1/${table}`, { method: 'POST', key: service, body });

async function denied(token, name, args, message = 'forbidden') {
  const result = await rpc(token, name, args);
  assert(!result.ok, `${name} unexpectedly succeeded`);
  assert.equal(result.data.message, message, name);
}
const runId = randomUUID();
const people = [];
const memberIds = new Set();
const published = randomUUID();
const unreported = randomUUID();
const sealed = randomUUID();

try {
  assert.deepEqual(ok(await rpc(owner, 'me')), { role: 'owner' });
  for (const role of ['admin', 'moderator', 'viewer', 'outsider']) {
    const email = `a1-${role}-${runId}@example.invalid`;
    const password = randomUUID();
    const user = ok(await request('/auth/v1/admin/users', { method: 'POST', key: service,
      body: { email, password, email_confirm: true, user_metadata: { name: `A1 ${role}` } } }));
    const person = { id: user.id, email, role };
    people.push(person);
    person.jwt = await signIn(email, password);
    const profile = await insert('profiles', { id: user.id, name: `A1 ${role}` });
    assert(profile.ok || profile.data?.code === '23505', JSON.stringify(profile.data));
  }
  const [admin, moderator, viewer, outsider] = people;
  const add = (email, role) => ({ p_email: email, p_role: role });
  const edit = (user, role) => ({ p_user: user, p_role: role });
  const resolve = (id, decision) => ({ p_kind: 'public_capsule_report', p_id: id, p_decision: decision, p_note: 'A1 API test' });
  const args = {
    members_list: {}, member_add: add(admin.email, 'admin'), member_set_role: edit(admin.id, 'viewer'),
    member_remove: { p_user: admin.id }, cities: {}, city_map: { p_region: 'taipei' },
    spawning: {}, queue: { p_status: 'open' }, queue_resolve: resolve(published, 'restore'),
    activity: { p_limit: 10, p_before: null },
  };

  assert.equal(ok(await rpc(outsider.jwt, 'me')), null);
  for (const [name, payload] of Object.entries(args)) await denied(outsider.jwt, name, payload);
  for (const member of [admin, moderator, viewer]) {
    ok(await rpc(owner, 'member_add', add(member.email, member.role)));
    memberIds.add(member.id);
  }
  await denied(owner, 'member_add', add(admin.email, 'admin'), 'already_member');
  const members = ok(await rpc(owner, 'members_list'));
  const roy = members.find(m => m.role === 'owner');
  assert.equal(roy.id, '1fd214ef-4de5-4b4f-81bc-77c3328441fe');
  await denied(owner, 'member_remove', { p_user: roy.id }, 'last_owner');
  await denied(owner, 'member_set_role', edit(roy.id, 'viewer'), 'last_owner');
  ok(await rpc(owner, 'member_set_role', edit(viewer.id, 'moderator')));
  assert.deepEqual(ok(await rpc(viewer.jwt, 'me')), { role: 'moderator' });
  ok(await rpc(owner, 'member_set_role', edit(viewer.id, 'viewer')));

  const spot = ok(await request('/rest/v1/public_capsule_spots?select=id,lat,lng&city_en=eq.Taipei&public_drop=is.true&limit=1', { key: service }))[0];
  const openAt = new Date(Date.now() - 60000).toISOString();
  const future = new Date(Date.now() + 3600000).toISOString();
  const publicCapsule = { sender: outsider.id, vessel: 'tin', open_at: openAt,
    is_public: true, public_capsule_spot: spot.id, recipient: null };
  ok(await insert('capsules', [
    { ...publicCapsule, id: published, hint: 'A1 reported' },
    { ...publicCapsule, id: unreported, hint: 'A1 unreported' },
    { ...publicCapsule, id: sealed, hint: 'A1 sealed', open_at: future, is_public: false,
      public_capsule_spot: null, recipient: viewer.id },
  ]));
  ok(await insert('capsule_contents', [
    { capsule_id: published, message: 'A1 VISIBLE REPORTED TEXT' },
    { capsule_id: unreported, message: 'A1 UNREPORTED TEXT' },
    { capsule_id: sealed, message: 'A1 SEALED TEXT' },
  ]));
  ok(await insert('public_capsule_reports', [
    { capsule_id: published, reporter: moderator.id, reason: 'spam' },
    { capsule_id: published, reporter: viewer.id, reason: 'personal' },
  ]));

  for (const member of [admin, moderator, viewer, { role: 'owner', jwt: owner }]) {
    assert.deepEqual(ok(await rpc(member.jwt, 'me')), { role: member.role });
    const cities = ok(await rpc(member.jwt, 'cities'));
    assert.equal(cities.length, 4);
    assert(cities.every(city => city.vessels.length === 6));
    const map = ok(await rpc(member.jwt, 'city_map', args.city_map));
    assert.equal(map.region.id, 'taipei');
    assert(map.wave.length > 100 && map.wayposts.some(p => p.kind === 'landmark'));
    const spawning = ok(await rpc(member.jwt, 'spawning'));
    assert.equal(spawning.config.nearby_max, 6);
    assert.equal(spawning.rules.filter(r => r.regions.length).length, 24);
    assert(ok(await rpc(member.jwt, 'activity', args.activity)).length > 0);
    const queue = ok(await rpc(member.jwt, 'queue', args.queue));
    const item = queue.find(q => q.id === published);
    assert(item.hidden);
    assert.equal(item.preview, member.role === 'viewer' ? null : 'A1 VISIBLE REPORTED TEXT');
    assert(!queue.some(q => q.id === unreported || q.id === sealed));
    const direct = await request(`/rest/v1/capsule_contents?select=message&capsule_id=in.(${published},${sealed})`, { token: member.jwt });
    assert(direct.status === 403 || (direct.ok && direct.data.length === 0));
    if (member.role !== 'owner') {
      for (const name of ['members_list', 'member_add', 'member_set_role', 'member_remove']) {
        await denied(member.jwt, name, args[name]);
      }
    }
  }
  await denied(viewer.jwt, 'queue_resolve', args.queue_resolve);

  const location = { p_lat: spot.lat, p_lng: spot.lng, p_accuracy: 10 };
  const pickup = token => request('/rest/v1/rpc/public_capsule_pick_up', { method: 'POST', token,
    body: { p_id: published, ...location } });
  const inbox = () => request(`/rest/v1/capsules?select=id,opened_at&id=eq.${published}&recipient=eq.${roy.id}`, { token: owner });
  const nearby = async token => ok(await request('/rest/v1/rpc/public_capsule_nearby', { method: 'POST', token,
    body: { p_lat: spot.lat, p_lng: spot.lng, p_accuracy: 10 } })).some(c => c.id === published);
  assert.equal(await nearby(admin.jwt), false);
  ok(await rpc(moderator.jwt, 'queue_resolve', args.queue_resolve));
  assert.equal(await nearby(admin.jwt), true);
  ok(await pickup(owner));
  const opened = ok(await request('/rest/v1/rpc/open_capsule', { method: 'POST', token: owner,
    body: { p_id: published, ...location } }));
  assert.equal(opened[0].message, 'A1 VISIBLE REPORTED TEXT');
  assert(ok(await inbox())[0].opened_at);
  ok(await insert('public_capsule_reports', { capsule_id: published, reporter: admin.id, reason: 'other' }));
  ok(await rpc(admin.jwt, 'queue_resolve', resolve(published, 'remove')));
  assert.equal(await nearby(admin.jwt), false);
  assert.deepEqual(ok(await inbox()), []);
  assert.equal((await pickup(owner)).data?.message, 'taken');
  const done = ok(await rpc(viewer.jwt, 'queue', { p_status: 'done' })).find(q => q.id === published);
  assert.equal(done.decision, 'remove');
  assert.equal(done.preview, null);
  const activity = ok(await rpc(owner, 'activity', args.activity));
  assert.deepEqual(activity.filter(a => a.target_id === published).map(a => a.action), ['queue.remove', 'queue.restore']);
  assert(!JSON.stringify(activity).includes('A1 VISIBLE REPORTED TEXT'));
  const removed = await rpc(owner, 'member_remove', { p_user: viewer.id });
  ok(removed);
  memberIds.delete(viewer.id);
  assert.equal(ok(await rpc(viewer.jwt, 'me')), null);
  console.log('PASS: all 11 admin RPCs with signed JWTs, permissions, sealed content, restore/remove, visibility and audit');
} finally {
  for (const p of people) {
    if (memberIds.has(p.id)) ok(await rpc(owner, 'member_remove', { p_user: p.id }));
    if (p.jwt) ok(await request('/auth/v1/logout', { method: 'POST', token: p.jwt }));
    ok(await request(`/auth/v1/admin/users/${p.id}`, { method: 'DELETE', key: service }));
  }
  ok(await request('/auth/v1/logout', { method: 'POST', token: owner }));
}
