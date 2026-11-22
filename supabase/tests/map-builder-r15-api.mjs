// Run only against the local Time Capsule stack with R1.5 loaded.
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
  const email = 'map-builder-r15-' + role + '-' + randomUUID() + '@example.invalid';
  const password = randomUUID();
  const { id } = await request('/auth/v1/admin/users', { method: 'POST', key: service,
    body: { email, password, email_confirm: true } });
  people.push(id);
  const { access_token: jwt } = await request('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password },
  });
  sql(`insert into public.profiles(id,name) values (${quote(id)},'R1.5 JWT test') on conflict do nothing;`);
  if (role !== 'player') sql(`insert into private.admin_members(user_id,role) values (${quote(id)},${quote(role)});`);
  return { id, jwt };
}
const addPost = (admin, point, extra) => rpc(admin, 'admin_waypost_add', {
  p_region: 'taipei', ...point, p_name_zh: '測試廣場', p_name_en: 'R1.5 JWT test', p_scene: 'square', ...extra,
});
const status = (admin, kind, ids, after) => rpc(admin, 'admin_place_set_status', {
  p_kind: kind, p_ids: ids, p_status: after,
});
const undo = (admin, id) => rpc(admin, 'admin_undo', { p_action_id: id });
const track = row => { places.push(row.id); return row; };
const lastAction = (actor, action) => Number(sql(`select max(id) from private.admin_actions
  where actor=${quote(actor.id)} and action=${quote(action)};`));

try {
  const admin = await person('admin');
  const viewer = await person('viewer');
  const player = await person('player');
  const [point, other, spare] = JSON.parse(sql(`with points as (
    select distinct on (cell) lat, lng, cell from (
      select 25.062 + i*0.0005 as lat, 121.552 + j*0.0005 as lng,
        private.s2_cell17(25.062 + i*0.0005, 121.552 + j*0.0005) as cell
      from generate_series(-7,7) i cross join generate_series(-7,7) j
      where private.admin_inside_border('taipei', 25.062 + i*0.0005, 121.552 + j*0.0005)
    ) p
    where private.s2_cell17(lat + 0.000001, lng) = cell
      and not exists (select 1 from public.public_capsule_spots w where w.status <> 'deleted'
        and (w.s2_cell17 = cell or public.distance_m(w.lat, w.lng, p.lat, p.lng) <= 110))
      and not exists (select 1 from public.corrupted_spots s where s.status = 'live'
        and public.distance_m(s.lat,s.lng,p.lat,p.lng) <= 110)
    order by cell, lat, lng limit 3
  ) select json_agg(json_build_object('p_lat',lat,'p_lng',lng)) from points;`));
  assert(point && other && spare, 'Need three isolated test points in distinct cells');
  const near = { ...point, p_accuracy: 8 };
  const check = id => rpc(admin, 'admin_waypost_check', { p_region: 'taipei', ...point, p_id: id ?? null });
  const area = { p_region: 'taipei', p_kind: 'waypost', p_south: 25.03, p_west: 121.55,
    p_north: 25.039, p_east: 121.56, p_spacing_m: 100 };
  await assert.rejects(addPost(viewer, point), /forbidden/);
  await assert.rejects(rpc(player, 'admin_area_suggest', area), /forbidden/);

  const post = track(await addPost(admin, point, { p_status: 'draft' }));
  assert.equal(post.status, 'draft');
  assert.equal((await check()).cell_taken, true);
  assert.equal((await check(post.id)).cell_taken, false);
  await assert.rejects(addPost(admin, point), /cell_taken/);
  for (const who of [viewer, player]) await assert.rejects(status(who, 'waypost', [post.id], 'live'), /forbidden/);
  assert.deepEqual(await request('/rest/v1/public_capsule_spots?id=eq.' + post.id, { token: player.jwt }), []);
  assert(!(await rpc(player, 'game_nearby', near)).wayposts.some(w => w.id === post.id));
  assert.equal((await rpc(player, 'waypost_rack', { waypost_id: post.id })).count, 0);
  await assert.rejects(rpc(player, 'public_capsule_drop', { ...near, p_message: 'QA safe message',
    p_hint: '', p_vessel: 'bottle', p_drift_days: 1 }), /no_shore/);
  await assert.rejects(rpc(player, 'rack_leave', { waypost_id: post.id, lat: point.p_lat, lng: point.p_lng,
    accuracy: 8, body: 'QA safe message', hint: '', wait_days: 0 }), /too_far/);
  await assert.rejects(rpc(player, 'public_capsule_return', { p_id: randomUUID() }), /not_allowed/);
  const moved = await rpc(admin, 'admin_waypost_update', { p_id: post.id, p_lat: point.p_lat + 0.000001 });
  assert.equal(moved.s2_cell17, post.s2_cell17);
  const live = track(await addPost(admin, other));
  assert.equal(live.status, 'live');
  await assert.rejects(rpc(admin, 'admin_waypost_update', { p_id: post.id, ...other }), /cell_taken/);

  await status(admin, 'waypost', [post.id], 'live');
  assert((await rpc(player, 'game_nearby', near)).wayposts.some(w => w.id === post.id));
  const rackPosition = { lat: point.p_lat, lng: point.p_lng, accuracy: 8 };
  const capsule = await rpc(player, 'rack_leave', { waypost_id: post.id, ...rackPosition,
    body: 'QA safe message', hint: '', wait_days: 1 });
  const rack = () => rpc(player, 'waypost_rack', { waypost_id: post.id });
  assert.equal((await rack()).items[0].capsule_id, capsule.capsule_id);
  await status(admin, 'waypost', [post.id], 'draft');
  assert.equal((await rack()).count, 0);
  await assert.rejects(rpc(viewer, 'rack_open', { capsule_id: capsule.capsule_id, ...rackPosition }), /too_far/);
  await undo(admin, lastAction(admin, 'waypost.status'));
  assert.equal((await rack()).items[0].capsule_id, capsule.capsule_id);
  await status(admin, 'waypost', [post.id], 'deleted');
  const deleted = lastAction(admin, 'waypost.status');
  assert(!(await rpc(admin, 'admin_city_map', { p_region: 'taipei' })).wayposts.some(w => w.id === post.id));
  assert(!(await rpc(player, 'game_nearby', near)).wayposts.some(w => w.id === post.id));
  const reuse = track(await addPost(admin, point, { p_status: 'draft' }));
  await assert.rejects(undo(admin, deleted), /cell_taken/);
  await status(admin, 'waypost', [reuse.id], 'deleted');
  await undo(admin, deleted);
  assert((await rpc(player, 'game_nearby', near)).wayposts.some(w => w.id === post.id));
  await status(admin, 'waypost', [post.id], 'hidden');
  assert.equal((await check()).cell_taken, true);
  assert(!(await rpc(player, 'game_nearby', near)).wayposts.some(w => w.id === post.id));

  const draftItem = p => ({ lat: p.p_lat, lng: p.p_lng, name_zh: '測試廣場', name_en: 'R1.5 batch', scene: 'park' });
  const batch = await rpc(admin, 'admin_waypost_add_batch', { p_region: 'taipei',
    p_items: [draftItem(spare), draftItem(point), { ...draftItem(spare), lat: 0, lng: 0 }] });
  assert.equal(batch.added.map(track).length, 1);
  assert.equal(batch.added[0].status, 'draft');
  assert.deepEqual(batch.skipped, [{ index: 1, reason: 'cell_taken' }, { index: 2, reason: 'outside_border' }]);
  const batchAction = lastAction(admin, 'waypost.add_batch');
  await rpc(admin, 'admin_waypost_update', { p_id: batch.added[0].id, p_name_en: 'Later edit' });
  await assert.rejects(undo(admin, batchAction), /stale/);

  const spots = await rpc(admin, 'admin_spot_add_batch', { p_region: 'taipei', p_items: [
    { lat: point.p_lat, lng: point.p_lng, habitat: 'park' },
    { lat: other.p_lat, lng: other.p_lng, habitat: 'square' },
    { lat: other.p_lat, lng: other.p_lng, habitat: 'invalid' },
  ] });
  assert.equal(spots.added.map(track).length, 2);
  assert.deepEqual(spots.skipped, [{ index: 2, reason: 'bad_habitat' }]);
  const spotBatchAction = lastAction(admin, 'spot.add_batch');
  const spawn = track(await rpc(admin, 'admin_spot_add', { p_region: 'taipei', ...point,
    p_habitat: 'square', p_status: 'draft' }));
  const seeSpot = async () => (await rpc(player, 'game_nearby', near)).spawns.some(s => s.spawn_id.startsWith(spawn.id + ':'));
  assert.equal(await seeSpot(), false);
  await status(admin, 'spot', [spawn.id], 'live');
  // Advance just the local fixture's eligibility, leaving the game clock alone.
  sql(`update public.corrupted_spots set first_spawn_wave=(select wave from private.game_wave_at(now()))
    where id=${quote(spawn.id)};`);
  assert.equal(await seeSpot(), true);
  await status(admin, 'spot', [spawn.id], 'hidden');
  assert.equal(await seeSpot(), false);
  await undo(admin, spotBatchAction);
  const map = await rpc(admin, 'admin_city_map', { p_region: 'taipei' });
  assert(spots.added.every(s => !map.spots.some(x => x.id === s.id)));

  await assert.rejects(rpc(admin, 'admin_area_suggest', { ...area, p_north: 26 }), /area_too_big/);
  const suggestions = await rpc(admin, 'admin_area_suggest', area);
  assert(suggestions.length > 0 && suggestions.length <= 100);
  const hunts = sql(`select array_agg(w.id)::text from public.hunts h join public.public_capsule_spots w
    on public.distance_m(w.lat,w.lng,h.area_lat,h.area_lng)<=h.area_radius_m
    where h.id='hkust-2026-11' and w.kind='common' and w.status='live';`).slice(1, -1).split(',');
  await assert.rejects(status(admin, 'waypost', hunts, 'hidden'), /hunt_needs_wayposts/);
  for (const city of ['taipei','hongkong','macau','singapore']) {
    const hunt = await rpc(player, 'todays_hunt', { p_city: city });
    assert.equal(hunt.quests.length, 3, city);
  }
  console.log('PASS: R1.5 real JWT roles, cells, publish, player reads, deletes and Undo, batch skips and stale guard, safe area, hunts');
} finally {
  if (people.length) {
    const actors = people.map(quote).join(',');
    const targets = places.length ? places.map(quote).join(',') : 'null';
    sql(`begin;
      delete from private.todays_hunt_plays where user_id in (${actors});
      delete from public.capsules where sender in (${actors}) and public_capsule_spot in (${targets});
      delete from private.admin_members where user_id in (${actors});
      alter table private.admin_actions disable trigger admin_audit_append_only;
      delete from private.admin_actions where actor in (${actors});
      alter table private.admin_actions enable trigger admin_audit_append_only;
      delete from public.public_capsule_spots where id in (${targets}) and source_ref='admin:'||id;
      delete from public.corrupted_spots where id in (${targets}) and source_ref='admin:'||id;
      commit;`);
    for (const id of people) await request('/auth/v1/admin/users/' + id, { method: 'DELETE', key: service });
    assert.equal(sql(`select (select count(*) from auth.users where id in (${actors}))
      + (select count(*) from public.public_capsule_spots where id in (${targets}))
      + (select count(*) from public.corrupted_spots where id in (${targets}));`), '0');
  }
}
