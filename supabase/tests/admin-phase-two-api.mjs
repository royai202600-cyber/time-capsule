// Against a local Supabase stack with Phase 2 loaded. Supply local anon and service keys.
// This crosses a real wave boundary and can take up to ten minutes at the default length.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const { ADMIN_TEST_ANON_KEY: anon, ADMIN_TEST_SERVICE_KEY: service } = process.env;
assert(anon && service, 'Set local Supabase test keys');
const base = 'http://127.0.0.1:54321';
const sql = input => execFileSync('docker', [
  'exec', '-i', 'supabase_db_time-capsule', 'psql', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1',
], { input, encoding: 'utf8' }).trim();
const sqlJson = input => JSON.parse(sql(input));
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const pause = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));

async function request(path, { method = 'GET', key = anon, token = key, body } = {}) {
  const response = await fetch(base + path, { method, headers: {
    apikey: key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json',
  }, body: body === undefined ? undefined : JSON.stringify(body) });
  const raw = await response.text();
  assert(response.ok, raw);
  return raw ? JSON.parse(raw) : null;
}
const rpc = (person, fn, body) => request('/rest/v1/rpc/' + fn, { method: 'POST', token: person.jwt, body });

const people = [];
async function person(role) {
  const email = 'admin-two-' + role + '-' + randomUUID() + '@example.invalid';
  const password = randomUUID();
  const user = await request('/auth/v1/admin/users', { method: 'POST', key: service,
    body: { email, password, email_confirm: true, user_metadata: { name: 'Admin Phase 2 ' + role } } });
  const p = { id: user.id, role };
  people.push(p);
  p.jwt = (await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })).access_token;
  sql(`insert into public.profiles(id,name) values (${quote(p.id)},'Admin Phase 2 fixture') on conflict (id) do nothing;`);
  return p;
}
const readClock = () => sqlJson('select row_to_json(w) from private.game_wave_at(now()) w;');

const original = sqlJson(`select jsonb_build_object('chance',cfg.spawn_chance,'common',cfg.rarity_common_weight,
  'uncommon',cfg.rarity_uncommon_weight,'rare',cfg.rarity_rare_weight,'nearby',cfg.nearby_spawn_target)
  from private.game_config cfg where singleton;`);
assert.equal(original.chance, 1, 'the local fixture expects every spot to release by default');
assert.equal(Number(sql("select count(*) from private.game_spawn_revisions where starts_at = '-infinity' or starts_at > now();")), 1,
  'use a fresh local Phase 2 migration');
let waypost;
let scheduled;
try {
  const editor = await person('editor');
  const player = await person('player');
  sql(`insert into private.admin_members(user_id,role) values (${quote(editor.id)},'admin');`);
  let clock = readClock();
  if (Date.parse(clock.ends_at) - Date.now() < 7_000) {
    await pause(Date.parse(clock.ends_at) - Date.now() + 400);
    clock = readClock();
  }
  const coords = sqlJson(`select row_to_json(s) from (
    select p.lat as p_lat,p.lng as p_lng,10 as p_accuracy from public.corrupted_spots p
    where p.city='Taipei' and p.hidden_at is null and p.source_ref not like 'qa:%'
      and not exists(select 1 from public.corrupted_spots q
        where q.lat between p.lat-.001 and p.lat+.001 and q.lng between p.lng-.0011 and p.lng+.0011
          and q.hidden_at is null and q.source_ref not like 'qa:%'
          and public.distance_m(p.lat,p.lng,q.lat,q.lng)<=100
          and private.game_roll(q.id::text||':${clock.wave + 1}:show')<0.1)
    order by p.id limit 1
  ) s;`);
  waypost = (await rpc(editor,'admin_waypost_add',{p_region:'taipei',p_lat:coords.p_lat,p_lng:coords.p_lng,
    p_name_zh:'測試',p_name_en:'Temporary JWT Waypost',p_scene:'park',p_checked:true,p_note:'local test override'})).id;
  const shown = await rpc(player,'game_nearby',coords);
  assert(shown.wayposts.some(row => row.id === waypost));
  assert(shown.spawns.length > 0);
  await rpc(editor,'admin_waypost_set_visible',{p_id:waypost,p_visible:false});
  assert(!(await rpc(player,'game_nearby',coords)).wayposts.some(row => row.id === waypost));

  await rpc(editor,'admin_wave_config_set',{p_spawn_chance:0.1,p_common_weight:original.common,
    p_uncommon_weight:original.uncommon,p_rare_weight:original.rare,p_nearby_target:original.nearby,p_note:'local JWT test'});
  scheduled = clock.ends_at;
  const current = await rpc(player,'game_nearby',coords);
  assert.deepEqual(current.spawns.map(s => s.spawn_id), shown.spawns.map(s => s.spawn_id),
    'changing the spawn chance must leave the current wave intact');
  console.log('PASS: real JWT Waypost add/hide and current-wave preservation. Checking the next boundary at ' + scheduled);
  await pause(Date.parse(scheduled) - Date.now() + 500);
  assert.equal(readClock().wave, clock.wave + 1);
  const next = await rpc(player,'game_nearby',coords);
  assert.equal(next.spawns.length, 0, 'the next wave must use the scheduled spawn chance');
  console.log('PASS: player JWT receives the changed next wave');
} finally {
  if (scheduled) {
    sql(`begin;
      select private.lock_game_edits();
      update private.game_config set spawn_chance=${original.chance} where singleton;
      delete from private.game_spawn_revisions where starts_at=${quote(scheduled)}
        or starts_at=(select ends_at from private.game_wave_at(now()));
      commit;`);
  }
  if (waypost) sql(`delete from public.public_capsule_spots where id=${quote(waypost)} and source_ref='admin:'||id;`);
  for (const p of people) {
    if (p.jwt) await request('/auth/v1/logout', { method: 'POST', token:p.jwt });
    sql(`delete from private.admin_members where user_id=${quote(p.id)};`);
    await request('/auth/v1/admin/users/' + p.id, { method: 'DELETE', key: service });
  }
  assert.equal(Number(sql("select count(*) from auth.users where email like 'admin-two-%@example.invalid';")), 0);
}
