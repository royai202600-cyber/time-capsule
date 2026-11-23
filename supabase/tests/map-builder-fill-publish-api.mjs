// Run only against the local Time Capsule stack with the Fill an area migration loaded.
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
  const email = 'map-builder-fill-publish-' + role + '-' + randomUUID() + '@example.invalid';
  const password = randomUUID();
  const { id } = await request('/auth/v1/admin/users', { method: 'POST', key: service,
    body: { email, password, email_confirm: true } });
  people.push(id);
  const { access_token: jwt } = await request('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password },
  });
  sql(`insert into public.profiles(id,name) values (${quote(id)},'Fill publish JWT test') on conflict do nothing;`);
  if (role !== 'player') sql(`insert into private.admin_members(user_id,role) values (${quote(id)},${quote(role)});`);
  return { id, jwt };
}
const region = 'taipei';
const batchPost = (who, items, options) =>
  rpc(who, 'admin_waypost_add_batch', { p_region: region, p_items: items, ...options });
const batchSpot = (who, items, options) =>
  rpc(who, 'admin_spot_add_batch', { p_region: region, p_items: items, ...options });
const drafts = who => rpc(who, 'admin_city_drafts', { p_region: region });
const remember = batch => {
  places.push(...batch.added.map(row => row.id));
  assert(Number.isSafeInteger(batch.action_id));
  return batch.added[0];
};

try {
  const admin = await person('admin');
  const owner = await person('owner');
  const viewer = await person('viewer');
  const moderator = await person('moderator');
  const player = await person('player');
  const [first, second, third, fourth] = JSON.parse(sql(`with points as (
    select distinct on (cell) lat, lng, cell from (
      select 25.062 + i*0.0006 as lat, 121.552 + j*0.0006 as lng,
        private.s2_cell17(25.062 + i*0.0006, 121.552 + j*0.0006) as cell
      from generate_series(-7,7) i cross join generate_series(-7,7) j
      where private.admin_inside_border('taipei', 25.062 + i*0.0006, 121.552 + j*0.0006)
    ) p where not exists (select from public.public_capsule_spots w
      where w.status <> 'deleted' and w.s2_cell17 = p.cell)
    order by cell, lat, lng limit 4
  ) select json_agg(json_build_object('lat',lat,'lng',lng)) from points;`));
  assert(first && second && third && fourth, 'Need four free Taipei cells');
  const post = point => ({ ...point, name_zh: '測試廣場', name_en: 'Fill publish JWT test', scene: 'square' });
  const spot = point => ({ ...point, habitat: 'square' });
  for (const restricted of [viewer, moderator, player]) {
    await assert.rejects(drafts(restricted), /forbidden/);
    await assert.rejects(batchPost(restricted, [post(first)], { p_status: 'live' }), /forbidden/);
    await assert.rejects(batchSpot(restricted, [spot(second)], { p_status: 'draft' }), /forbidden/);
  }
  await assert.rejects(batchPost(admin, [post(first)], { p_status: 'hidden' }), /bad_status/);

  const liveBatch = randomUUID();
  const liveOptions = { p_status: 'live', p_batch: liveBatch };
  const livePostResult = await batchPost(admin, [post(first)], liveOptions);
  const livePost = remember(livePostResult);
  const liveSpotResult = await batchSpot(admin, [spot(second)], liveOptions);
  const liveSpot = remember(liveSpotResult);
  assert.equal(livePost.status, 'live');
  assert.equal(livePost.game_enabled, true);
  assert.equal(livePost.hidden_at, null);
  assert.equal(liveSpot.status, 'live');
  assert.equal(liveSpot.hidden_at, null);
  assert(Number.isSafeInteger(liveSpot.first_spawn_wave));

  const near = { p_lat: first.lat, p_lng: first.lng, p_accuracy: 8 };
  const nearby = () => rpc(player, 'game_nearby', near);
  assert((await nearby()).wayposts.some(row => row.id === livePost.id), 'The live batch Waypost is visible to players');
  assert.deepEqual(await batchPost(admin, [post(first)]), {
    added: [], skipped: [{ index: 0, reason: 'cell_taken' }], action_id: null,
  });

  const shared = randomUUID();
  const draftOptions = { p_status: 'draft', p_batch: shared };
  const draftPostResult = await batchPost(admin, [post(second)], draftOptions);
  const draftPost = remember(draftPostResult);
  const draftSpotResult = await batchSpot(admin, [spot(first)], draftOptions);
  const draftSpot = remember(draftSpotResult);
  assert.equal(draftPost.status, 'draft');
  assert.equal(draftPost.game_enabled, false);
  assert.equal(draftSpot.status, 'draft');
  assert(!(await nearby()).wayposts.some(row => row.id === draftPost.id), 'Draft stays off the player map');

  const oldClientResult = await batchPost(admin, [post(third)]);
  const oldClient = remember(oldClientResult);
  assert.equal(oldClient.status, 'draft');

  const args = { p_region: region, p_lat: fourth.lat, p_lng: fourth.lng, p_status: 'draft' };
  const singlePost = await rpc(admin, 'admin_waypost_add', {
    ...args, p_name_zh: '測試廣場', p_name_en: 'Individual JWT draft', p_scene: 'square',
  });
  places.push(singlePost.id);
  const singleSpot = await rpc(admin, 'admin_spot_add', { ...args, p_habitat: 'square' });
  places.push(singleSpot.id);
  const ownerSpot = await rpc(owner, 'admin_spot_add', { ...args, p_habitat: 'park' });
  places.push(ownerSpot.id);

  const groups = await drafts(owner);
  const mixed = groups.filter(group => group.batch === shared);
  assert.equal(mixed.length, 1, 'Two requests from a Fill an area save form one group');
  assert.deepEqual(mixed[0].wayposts, [draftPost.id]);
  assert.deepEqual(mixed[0].spots, [draftSpot.id]);
  assert.equal(mixed[0].actor.id, admin.id);
  assert.equal(mixed[0].actor.name, 'Fill publish JWT test');
  assert(mixed[0].at);
  assert(!groups.some(group => group.batch === liveBatch));
  assert(groups.some(group => group.batch === String(oldClientResult.action_id)
    && group.wayposts.includes(oldClient.id)));
  assert(groups.some(group => group.batch === null && group.actor?.id === admin.id
    && group.wayposts.includes(singlePost.id) && group.spots.includes(singleSpot.id)));
  assert(groups.some(group => group.batch === null && group.actor?.id === owner.id
    && group.spots.includes(ownerSpot.id) && !group.spots.includes(singleSpot.id)));

  for (const [result, place] of [[liveSpotResult, liveSpot], [livePostResult, livePost],
    [draftSpotResult, draftSpot], [draftPostResult, draftPost], [oldClientResult, oldClient]]) {
    const undone = await rpc(admin, 'admin_undo', { p_action_id: result.action_id });
    assert.equal(undone[place.id].status, 'deleted');
  }
  assert(!(await nearby()).wayposts.some(row => row.id === livePost.id));
  assert(!(await drafts(admin)).some(group => group.batch === shared));
  console.log('PASS: real JWT Live and Draft batches, action IDs and Undo, role refusal, old client defaults, and mixed draft grouping');
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
      delete from public.corrupted_spots where id in (${targets}) and source_ref='admin:'||id;
      commit;`);
    for (const id of people) await request('/auth/v1/admin/users/' + id, { method: 'DELETE', key: service });
    assert.equal(sql(`select (select count(*) from auth.users where id in (${actors}))
      + (select count(*) from private.admin_actions where actor in (${actors}))
      + (select count(*) from public.public_capsule_spots where id in (${targets}))
      + (select count(*) from public.corrupted_spots where id in (${targets}));`), '0');
    console.log('Verified zero local test users, places, and actions remain');
  }
}
