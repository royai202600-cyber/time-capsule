// Run only against the local Time Capsule stack with the named Landmark migration loaded.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const { ADMIN_TEST_ANON_KEY: anon, ADMIN_TEST_SERVICE_KEY: service } = process.env;
assert(anon && service, 'Supply the local Supabase test keys');
const base = 'http://127.0.0.1:54321';
const sql = input => execFileSync('docker', [
  'exec', '-i', 'supabase_db_time-capsule', 'psql', '-U', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1',
], { input, encoding: 'utf8' }).trim();
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const people = [];
const places = [];

async function request(path, { method = 'GET', key = anon, token = key, body } = {}) {
  const response = await fetch(base + path, {
    method, headers: { apikey: key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : undefined;
  if (!response.ok) throw new Error(data?.message ?? data?.msg ?? raw);
  return data;
}

const rpc = (person, name, body) => request('/rest/v1/rpc/' + name, { method: 'POST', token: person.jwt, body });
async function person(role) {
  const email = 'landmark-named-models-' + role + '-' + randomUUID() + '@example.invalid';
  const password = randomUUID();
  const { id } = await request('/auth/v1/admin/users', { method: 'POST', key: service,
    body: { email, password, email_confirm: true } });
  people.push(id);
  const { access_token: jwt } = await request('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password },
  });
  sql(`insert into public.profiles(id,name) values (${quote(id)},'Named Landmark JWT test') on conflict do nothing;`);
  if (role !== 'player') sql(`insert into private.admin_members(user_id,role) values (${quote(id)},${quote(role)});`);
  return { id, jwt };
}

const note = 'Convert the three seeded custom Landmark shapes to named models.';
const asSettings = monument => ({ monument, vessel: 'landmark-keepsake',
  stamp: 'landmark-default', fight_health: 40, fight_seconds: 150 });

try {
  const admin = await person('admin');
  const batch = JSON.parse(sql(`select to_jsonb(a) from private.admin_actions a
    where a.note=${quote(note)} order by a.id desc limit 1;`));
  const targets = batch.target_id.split(',');
  assert.equal(targets.length, 3);

  const point = JSON.parse(sql(`with points as (
    select 25.062+i*.0006 lat, 121.552+j*.0006 lng
    from generate_series(-7,7) i cross join generate_series(-7,7) j
  ) select json_build_object('lat',lat,'lng',lng) from points
    where private.admin_inside_border('taipei',lat,lng)
      and not exists (select from public.public_capsule_spots w where w.status<>'deleted'
        and w.s2_cell17=private.s2_cell17(points.lat,points.lng))
    order by lat,lng limit 1;`));
  const monumentFor = kind => ({ model: { kind, size: 'm', rotate: 0, color: 'ink' } });
  const added = await rpc(admin, 'admin_waypost_add', {
    p_region: 'taipei', p_lat: point.lat, p_lng: point.lng, p_name_zh: '地標模型測試',
    p_name_en: 'Named Landmark JWT test', p_scene: 'square', p_status: 'draft',
    p_kind: 'landmark', p_landmark: asSettings(monumentFor('taipei101')),
  });
  places.push(added.id);
  assert.deepEqual(added.monument, monumentFor('taipei101'));

  const update = monument => rpc(admin, 'admin_landmark_set', {
    p_id: added.id, p_landmark: asSettings(monument),
  });
  for (const kind of ['senado', 'hkust']) {
    assert(Number.isSafeInteger(await update(monumentFor(kind))));
    const result = await rpc(admin, 'admin_city_map', { p_region: 'taipei' });
    assert.deepEqual(result.wayposts.find(w => w.id === added.id).landmark.monument, monumentFor(kind));
  }
  await assert.rejects(update(monumentFor('unrecognized')), /bad_monument/);
  assert(Number.isSafeInteger(await update({ custom: { color: 'landmark', tiers: [[3, 0, 6]] } })));

  const undone = await rpc(admin, 'admin_undo', { p_action_id: batch.id });
  assert.deepEqual(undone, batch.before);
  console.log('PASS: signed-in named models, unknown refusal, legacy custom and exact Activity Undo');
} finally {
  if (people.length) {
    const actors = people.map(quote).join(',');
    const targets = places.length ? places.map(quote).join(',') : 'null';
    sql(`begin;
      delete from private.admin_members where user_id in (${actors});
      alter table private.admin_actions disable trigger admin_audit_append_only;
      delete from private.admin_actions where actor in (${actors});
      alter table private.admin_actions enable trigger admin_audit_append_only;
      delete from public.public_capsule_spots where id in (${targets}) and source_ref='admin:'||id;
      commit;`);
    for (const id of people) await request('/auth/v1/admin/users/' + id, { method: 'DELETE', key: service });
    assert.equal(sql(`select count(*) from auth.users where id in (${actors});`), '0');
    assert.equal(sql(`select count(*) from public.public_capsule_spots where id in (${targets});`), '0');
  }
}
