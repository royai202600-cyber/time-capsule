// Run against the reset Time Capsule local stack: API_URL, ANON_KEY, SERVICE_ROLE_KEY.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { API_URL, ANON_KEY, SERVICE_ROLE_KEY } = process.env;
assert(API_URL && ['127.0.0.1', 'localhost'].includes(new URL(API_URL).hostname), 'Use local Supabase');
assert(ANON_KEY && SERVICE_ROLE_KEY, 'Provide the local API keys');
const sql = (body) => execFileSync('docker', ['exec', '-i', 'supabase_db_time-capsule',
  'psql', '-X', '-qAt', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'],
{ input: body, encoding: 'utf8' }).trim();
const literal = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const users = [];
const waveStarts = "select starts_at from private.game_wave_at(now()) union select ends_at from private.game_wave_at(now())";
const revisions = sql(`select coalesce(jsonb_agg(r),'[]') from private.game_spawn_revisions r where starts_at in (${waveStarts})`);
const config = sql("select jsonb_build_array(restore_common,restore_uncommon,restore_rare) from private.game_config where singleton");
const waveTimes = sql(`select string_agg(quote_literal(s.starts_at), ',') from (${waveStarts}) s`);

async function request(path, body, token, key = ANON_KEY) {
  const headers = { 'content-type': 'application/json', apikey: key };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(API_URL + path, { method: 'POST', headers, body: JSON.stringify(body) });
  return { ok: response.ok, data: await response.json() };
}

function ok(response) {
  assert(response.ok, JSON.stringify(response.data));
  return response.data;
}

function denied(response, message) {
  assert.equal(response.ok, false);
  assert.equal(response.data.message, message);
}

async function player() {
  const credentials = { email: `df-finish-${randomUUID()}@example.com`, password: randomUUID() };
  const user = ok(await request('/auth/v1/admin/users', { ...credentials, email_confirm: true }, null, SERVICE_ROLE_KEY));
  users.push(user.id);
  sql(`insert into public.profiles(id,name) values (${literal(user.id)},'Finish RPC QA') on conflict do nothing;
    select private.ensure_player(${literal(user.id)});
    update public.player_game set wax_balls=100,gold_balls=12 where user_id=${literal(user.id)};`);
  const session = ok(await request('/auth/v1/token?grant_type=password', credentials));
  assert.equal(session.user.id, user.id);
  assert.equal(session.access_token.split('.').length, 3);
  return { id: user.id, rpc: (name, args = {}) => request('/rest/v1/rpc/' + name, args, session.access_token) };
}

try {
  const fixtureSource = readFileSync(new URL('./dodge-fight-fixtures.sql', import.meta.url), 'utf8');
  const fixture = JSON.parse(sql(`begin; ${fixtureSource}\nselect pg_temp.dodge_fixture(); commit;`));
  const [{ id, rpc }, rival] = await Promise.all([player(), player()]);
  const coords = { p_lat: fixture.lat, p_lng: fixture.lng, p_accuracy: 10 };
  const state = async () => ok(await rpc('game_state'))[0];
  const start = async (spawn = fixture.spawns.common[0]) => ok(await rpc('corrupted_fight_start', { p_spawn: spawn, ...coords }))[0];
  const landmark = async () => ok(await rpc('landmark_start', { p_waypost: fixture.waypost, ...coords }))[0];
  const finishArgs = (fight, result, wax, gold) => ({ p_fight: fight, p_result: result, p_wax_used: wax, p_gold_used: gold, ...coords });
  const allowTime = (table, fight) => sql(`update ${table} set started_at=clock_timestamp()-interval '30 seconds' where id=${literal(fight)};`);
  const expire = (table, fight) => sql(`update ${table} set expires_at=clock_timestamp()-interval '1 second' where id=${literal(fight)};`);

  let fight = await start();
  assert.deepEqual(await start(), fight);
  const win = finishArgs(fight.fight_id, 'won', 1, 1);
  denied(await rival.rpc('corrupted_fight_finish', win), 'expired');
  denied(await rpc('corrupted_fight_finish', { ...win, p_wax_used: 0, p_gold_used: 0 }), 'not_enough_damage');
  denied(await rpc('corrupted_fight_finish', { ...win, p_wax_used: 101 }), 'no_balls');
  denied(await rpc('corrupted_fight_finish', win), 'too_soon');
  const unspent = await state();
  assert.equal(unspent.wax_balls, 100);
  assert.equal(unspent.gold_balls, 12);
  allowTime('private.corrupted_fights', fight.fight_id);
  sql(`update public.player_game set last_lat=${coords.p_lat + .004},last_position_at=clock_timestamp() where user_id=${literal(id)};`);
  denied(await rpc('corrupted_fight_finish', win), 'too_fast');
  sql(`update public.player_game set last_lat=${coords.p_lat} where user_id=${literal(id)};`);
  const replies = await Promise.all([rpc('corrupted_fight_finish', win), rpc('corrupted_fight_finish', win)]);
  const outcome = ok(replies[0]);
  assert.deepEqual(ok(replies[1]), outcome);
  assert.equal(outcome.result, 'won');
  assert(outcome.vessel && outcome.copies > 0 && outcome.xp_gained > 0);
  assert.equal((await state()).wax_balls, 99);
  assert.equal((await state()).gold_balls, 11);
  assert.deepEqual(ok(await rpc('corrupted_fight_finish', win)), outcome);
  assert.equal((await state()).wax_balls, 99);
  denied(await rival.rpc('corrupted_fight_finish', win), 'expired');

  for (const remaining of [2, 1, 0]) {
    fight = await start(fixture.spawns.common[1]);
    allowTime('private.corrupted_fights', fight.fight_id);
    const loss = finishArgs(fight.fight_id, 'lost', 1, 0);
    const out = ok(await rpc('corrupted_fight_finish', loss));
    assert.equal(out.result, 'lost');
    assert.equal(out.attempts_left, remaining);
    assert.deepEqual(ok(await rpc('corrupted_fight_finish', loss)), out);
  }
  denied(await rpc('corrupted_fight_start', { p_spawn: fixture.spawns.common[1], ...coords }), 'no_attempts');

  fight = await start(fixture.spawns.common[2]);
  const beforeExpiry = await state();
  expire('private.corrupted_fights', fight.fight_id);
  denied(await rpc('corrupted_fight_finish', finishArgs(fight.fight_id, 'lost', 2, 0)), 'expired');
  assert.equal((await state()).wax_balls, beforeExpiry.wax_balls);
  console.log('PASS real JWT: Corrupted win, validation, rival, loss, expiry and concurrent replay with one spend');

  let attempt = await landmark();
  assert.equal(attempt.cracks, 20);
  assert(Math.abs(Date.parse(attempt.expires_at) - Date.now() - 150000) < 3000);
  const landmarkWin = finishArgs(attempt.attempt_id, 'won', 0, 10);
  denied(await rival.rpc('landmark_finish', landmarkWin), 'expired');
  denied(await rpc('landmark_finish', { ...landmarkWin, p_gold_used: 12 }), 'no_balls');
  denied(await rpc('landmark_finish', { ...landmarkWin, p_gold_used: 9 }), 'not_enough_damage');
  denied(await rpc('landmark_finish', landmarkWin), 'too_soon');
  allowTime('public.landmark_attempts', attempt.attempt_id);
  const results = await Promise.all([rpc('landmark_finish', landmarkWin), rpc('landmark_finish', landmarkWin)]);
  const won = ok(results[0]);
  assert.deepEqual(ok(results[1]), won);
  assert.equal(won.result, 'won');
  assert(won.vessel && won.copies === null && won.xp_gained > 0);
  assert.equal((await state()).gold_balls, 1);
  assert.equal(sql(`select count(*) from public.passport_stamps where user_id=${literal(id)} and place='taipei101'`), '1');
  assert.deepEqual(ok(await rpc('landmark_finish', landmarkWin)), won);
  assert.equal((await state()).gold_balls, 1);

  attempt = await landmark();
  const [legacy] = ok(await rpc('landmark_hit', { p_attempt: attempt.attempt_id, p_ball: 'wax', p_ring: 1, ...coords }));
  assert.equal(legacy.result, 'hit');
  assert(legacy.cracks < 20);
  const loss = finishArgs(attempt.attempt_id, 'lost', 1, 0);
  allowTime('public.landmark_attempts', attempt.attempt_id);
  const lost = ok(await rpc('landmark_finish', loss));
  assert.equal(lost.result, 'lost');
  assert.deepEqual(ok(await rpc('landmark_finish', loss)), lost);

  const next = await landmark();
  assert.notEqual(next.attempt_id, attempt.attempt_id);
  expire('public.landmark_attempts', next.attempt_id);
  denied(await rpc('landmark_finish', finishArgs(next.attempt_id, 'lost', 0, 0)), 'expired');
  const [oldCapsule] = ok(await rpc('corrupted_capsule_throw', {
    p_spawn: fixture.spawns.common[3], p_ball: 'wax', p_hit: true, p_ring: 1, ...coords,
  }));
  assert.equal(oldCapsule.result, 'restored');
  console.log('PASS real JWT: Landmark win, stamp, loss, expiry, validation, concurrent replay and both legacy RPCs');
} finally {
  if (users.length) {
    const ids = users.map(literal).join(',');
    sql(`delete from auth.users where id in (${ids})`);
    assert.equal(sql(`select count(*) from auth.users where id in (${ids})`), '0');
  }
  sql(`delete from public.corrupted_spots where source_ref like 'qa:df1:%';
    delete from private.game_spawn_revisions where starts_at in (${waveTimes});
    insert into private.game_spawn_revisions select * from jsonb_populate_recordset(null::private.game_spawn_revisions,${literal(revisions)});
    update private.game_config set restore_common=(${literal(config)}::jsonb->>0)::float,
      restore_uncommon=(${literal(config)}::jsonb->>1)::float,restore_rare=(${literal(config)}::jsonb->>2)::float where singleton;`);
}
