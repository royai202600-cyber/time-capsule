// Run only against the local Time Capsule stack with the R2 migration loaded.
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
  const email = 'map-builder-r2-' + role + '-' + randomUUID() + '@example.invalid';
  const password = randomUUID();
  const { id } = await request('/auth/v1/admin/users', { method: 'POST', key: service,
    body: { email, password, email_confirm: true } });
  people.push(id);
  const { access_token: jwt } = await request('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password },
  });
  sql(`insert into public.profiles(id,name) values (${quote(id)},'R2 JWT test') on conflict do nothing;`);
  if (role !== 'player') sql(`insert into private.admin_members(user_id,role) values (${quote(id)},${quote(role)});`);
  return { id, jwt };
}
const region = 'taipei';
const landmark = (who, id, p_landmark) => rpc(who, 'admin_landmark_set', { p_id: id, p_landmark });
const city = who => rpc(who, 'admin_city_map', { p_region: region });
const seed = JSON.parse(process.env.R2_TEST_MONUMENTS ?? 'null');
assert(seed, 'Supply the MONUMENT_SEED export in R2_TEST_MONUMENTS');

const sorted = object => {
  if (Array.isArray(object)) return object.map(sorted);
  if (object === null || typeof object !== 'object') return object;
  return Object.fromEntries(Object.keys(object).sort().map(key => [key, sorted(object[key])]));
};

try {
  const admin = await person('admin');
  const owner = await person('owner');
  const viewer = await person('viewer');
  const moderator = await person('moderator');
  const player = await person('player');
  const points = JSON.parse(sql(`with points as (
    select distinct on (cell) lat, lng, cell from (
      select 25.062 + i*0.0006 as lat, 121.552 + j*0.0006 as lng,
        private.s2_cell17(25.062 + i*0.0006, 121.552 + j*0.0006) as cell
      from generate_series(-7,7) i cross join generate_series(-7,7) j
      where private.admin_inside_border('taipei', 25.062 + i*0.0006, 121.552 + j*0.0006)
    ) p where not exists (select from public.public_capsule_spots w
      where w.status <> 'deleted' and w.s2_cell17 = p.cell)
    order by cell, lat, lng limit 5
  ) select json_agg(json_build_object('p_lat',lat,'p_lng',lng) order by cell) from points;`));
  assert.equal(points.length, 5);
  const add = async (who, point, options = {}) => {
    const row = await rpc(who, 'admin_waypost_add', {
      p_region: region, ...point, p_name_zh: '測試地標',
      p_name_en: 'R2 JWT test', p_scene: 'square', ...options,
    });
    places.push(row.id);
    return row;
  };

  const existing = JSON.parse(sql("select json_object_agg(place,monument) from public.public_capsule_spots where kind='landmark' and place is not null;"));
  for (const [place, monument] of Object.entries(existing)) {
    assert.equal(JSON.stringify(sorted(monument)), JSON.stringify(sorted(seed[place] ?? null)));
  }
  assert(Object.keys(seed).every(key => key in existing));

  for (const restricted of [viewer, moderator, player]) {
    await assert.rejects(add(restricted, points[0], { p_kind: 'landmark' }), /forbidden/);
    await assert.rejects(landmark(restricted, randomUUID(), {}), /forbidden/);
  }

  const common = await add(admin, points[0]);
  assert.equal(common.kind, 'common');
  const defaults = await add(owner, points[1], { p_kind: 'landmark', p_status: 'draft' });
  assert.deepEqual((await city(admin)).wayposts.find(w => w.id === defaults.id).landmark,
    { monument: null, vessel: 'landmark-keepsake', stamp: 'landmark-default', fight_health: 40, fight_seconds: 150 });
  const statuses = (id, p_status) => rpc(admin, 'admin_place_set_status', { p_kind: 'waypost', p_ids: [id], p_status });
  const nearby = (name, point) => rpc(player, name, { ...point, p_accuracy: 8 });
  assert(!(await nearby('game_nearby', points[1])).wayposts.some(w => w.id === defaults.id));
  await statuses(defaults.id, 'live');

  const monuments = [
    { buildings: { ids: [35184577873359], real_top: 26.2, top: 12, color: 'landmark' } },
    { model: { kind: 'gate', size: 's', rotate: 359, color: 'wax' } },
    { custom: { tiers: [[2, 0, 1, { round: true }]], color: 'brass' } },
  ];
  for (const [i, monument] of monuments.entries()) {
    const added = await add(admin, points[i + 2], { p_kind: 'landmark', p_landmark: { monument } });
    assert.deepEqual(added.monument, monument);
  }
  await assert.rejects(landmark(admin, defaults.id, { monument: { buildings: { ids: ['1'] } } }), /bad_monument/);
  await assert.rejects(landmark(admin, defaults.id, { monument: { custom: { tiers: Array(61).fill([2,0,1]), color: 'ink' } } }), /bad_monument/);
  await assert.rejects(landmark(admin, defaults.id, { monument: { buildings: {
    ids: Array.from({ length: 301 }, (_, i) => i), real_top: 10, top: 10, color: 'glass',
  } } }), /bad_monument/);

  const { capsule_id: rackId } = await rpc(player, 'rack_leave', {
    waypost_id: common.id, lat: common.lat, lng: common.lng, accuracy: 8, body: 'R2 test letter', hint: '', wait_days: 1,
  });
  await assert.rejects(landmark(admin, common.id, {}), /rack_not_empty/);
  sql(`update public.capsules set rack_removed_at=now() where id=${quote(rackId)};`);
  const action = await landmark(owner, common.id, { monument: monuments[1], stamp: 'r2-jwt' });
  assert(Number.isSafeInteger(action));
  assert.equal((await city(admin)).wayposts.find(w => w.id === common.id).kind, 'landmark');
  assert.deepEqual(await rpc(owner, 'admin_undo', { p_action_id: action }), common);

  const settings = { fight_health: 10, fight_seconds: 75, stamp: 'r2-jwt', monument: monuments[2] };
  await landmark(admin, defaults.id, settings);
  for (const name of ['game_nearby', 'corrupted_nearby']) {
    const { wayposts } = await nearby(name, points[1]);
    const row = wayposts.find(w => w.id === defaults.id);
    assert.deepEqual(row.monument, settings.monument);
    assert.equal(row.vessel, 'landmark-keepsake');
    assert.equal(row.stamp, 'r2-jwt');
    assert.equal(row.place, null);
    assert(wayposts.some(w => w.place === 'taipei101'));
  }

  const purchase = { p_vessel: 'landmark-keepsake' };
  await assert.rejects(rpc(player, 'acquire_vessel', purchase), /vessel must be earned/);
  const send = () => rpc(player, 'send_capsule', {
    p_recipient: player.id, p_vessel: 'landmark-keepsake', p_message: 'R2 earned test',
    p_hint: '', p_open_at: new Date(Date.now() + 3600000).toISOString(),
  });
  await assert.rejects(send(), /vessel not owned/);
  sql(`update public.player_game set wax_balls=50 where user_id=${quote(player.id)};`);

  const target = { ...points[1], p_accuracy: 8 };
  for (let copies = 1; copies <= 2; copies++) {
    const [attempt] = await rpc(player, 'landmark_start', { p_waypost: defaults.id, ...target });
    assert.equal(attempt.max_health, 10);
    assert.equal(sql(`select extract(epoch from expires_at-started_at)::int
      from public.landmark_attempts where id=${quote(attempt.attempt_id)};`), '75');
    sql(`update public.landmark_attempts set started_at=clock_timestamp()-interval '20 seconds'
      where id=${quote(attempt.attempt_id)};`);
    const won = await rpc(player, 'landmark_finish', {
      p_fight: attempt.attempt_id, p_result: 'won', p_wax_used: 10, p_gold_used: 0, ...target,
    });
    assert.equal(won.vessel, 'landmark-keepsake');
    assert.equal(won.stars, copies);
    assert.equal(won.copies, null);
    assert.equal(won.is_new, copies === 1);
    const stamps = await rpc(player, 'my_passport', {});
    assert.equal(stamps.length, 1);
    assert.equal(stamps[0].landmark, defaults.id);
    assert.equal(stamps[0].stamp, 'r2-jwt');
    assert.equal(stamps[0].name_en, defaults.name_en);
    assert.equal(stamps[0].name_zh, defaults.name_zh);
  }
  assert(await send());
  console.log('PASS: R2 local signed-in API, MONUMENT_SEED bytes, defaults and shapes, roles, Undo and rack, nearby compatibility, custom fight, repeat rewards and Passport');
} finally {
  if (people.length) {
    const actors = people.map(quote).join(',');
    const targets = places.length ? places.map(quote).join(',') : 'null';
    sql(`begin;
      delete from public.capsules where sender in (${actors});
      delete from private.fight_finish_receipts where user_id in (${actors});
      delete from private.landmark_passport_stamps where user_id in (${actors});
      delete from public.landmark_attempts where user_id in (${actors});
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
