// Run against the reset Time Capsule local stack: API_URL, ANON_KEY, SERVICE_ROLE_KEY.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { API_URL, ANON_KEY, SERVICE_ROLE_KEY, DB_CONTAINER = 'supabase_db_time-capsule' } = process.env;
assert(API_URL && ['127.0.0.1', 'localhost'].includes(new URL(API_URL).hostname), 'Use local Supabase');
assert(ANON_KEY && SERVICE_ROLE_KEY, 'Provide the local API keys');
const sql = (body) => execFileSync('docker', ['exec', '-i', DB_CONTAINER,
  'psql', '-X', '-qAt', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'],
{ input: body, encoding: 'utf8' }).trim();
const literal = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const users = [];
let graceWave;
const graceRevisions = [];
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
  const user = ok(await request('/auth/v1/admin/users', { ...credentials, email_confirm: true }, SERVICE_ROLE_KEY, SERVICE_ROLE_KEY));
  users.push(user.id);
  sql(`insert into public.profiles(id,name) values (${literal(user.id)},'Finish RPC QA') on conflict do nothing;
    select private.ensure_player(${literal(user.id)});
    update public.player_game set wax_balls=100,gold_balls=22 where user_id=${literal(user.id)};`);
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
  assert.equal(fight.health, 10);
  assert.equal(fight.max_health, 10);
  for (const [rarity, health] of [['uncommon', 12], ['rare', 14]]) {
    const started = await start(fixture.spawns[rarity][0]);
    assert.equal(started.health, health);
    assert.equal(started.max_health, health);
  }
  for (const [rarity, health] of [['common', 3], ['uncommon', 4]]) {
    const spawn = fixture.spawns[rarity][0];
    const [spot, wave] = spawn.split(':');
    const id = sql(`insert into private.corrupted_fights(user_id,spawn_id,max_health,health,expires_at)
      select ${literal(rival.id)},${literal(spawn)},${health},${health},s.expires_at
      from private.resolve_spawn(${literal(spot)},${Number(wave)}) s returning id;`);
    const [resumed] = ok(await rival.rpc('corrupted_fight_start', { p_spawn: spawn, ...coords }));
    assert.equal(resumed.fight_id, id);
    assert.equal(resumed.health, health);
    assert.equal(resumed.max_health, health);
  }
  console.log('PASS real JWT: 10/12/14 starting health and legacy 3/4 HP fights resume unchanged');
  assert.deepEqual(await start(), fight);
  const win = finishArgs(fight.fight_id, 'won', 8, 1);
  denied(await rival.rpc('corrupted_fight_finish', win), 'expired');
  denied(await rpc('corrupted_fight_finish', { ...win, p_wax_used: 7 }), 'not_enough_damage');
  denied(await rpc('corrupted_fight_finish', { ...win, p_wax_used: 101 }), 'no_balls');
  denied(await rpc('corrupted_fight_finish', win), 'too_soon');
  const unspent = await state();
  assert.equal(unspent.wax_balls, 100);
  assert.equal(unspent.gold_balls, 22);
  allowTime('private.corrupted_fights', fight.fight_id);
  sql(`update public.player_game set last_lat=${coords.p_lat + .004},last_position_at=clock_timestamp() where user_id=${literal(id)};`);
  denied(await rpc('corrupted_fight_finish', win), 'too_fast');
  sql(`update public.player_game set last_lat=${coords.p_lat} where user_id=${literal(id)};`);
  const replies = await Promise.all([rpc('corrupted_fight_finish', win), rpc('corrupted_fight_finish', win)]);
  const outcome = ok(replies[0]);
  assert.deepEqual(ok(replies[1]), outcome);
  assert.equal(outcome.result, 'won');
  assert(outcome.vessel && outcome.copies > 0 && outcome.xp_gained > 0);
  assert.equal((await state()).wax_balls, 92);
  assert.equal((await state()).gold_balls, 21);
  assert.deepEqual(ok(await rpc('corrupted_fight_finish', win)), outcome);
  assert.equal((await state()).wax_balls, 92);
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
  sql(`update private.corrupted_fights set expires_at=clock_timestamp()-interval '61 seconds',
    started_at=clock_timestamp()-interval '70 seconds' where id=${literal(fight.fight_id)};`);
  denied(await rpc('corrupted_fight_finish', finishArgs(fight.fight_id, 'lost', 2, 0)), 'expired');
  assert.equal((await state()).wax_balls, beforeExpiry.wax_balls);
  console.log('PASS real JWT: Corrupted win, validation, rival, loss, expiry and concurrent replay with one spend');

  let attempt = await landmark();
  assert.equal(attempt.cracks, 40);
  assert.equal(attempt.max_health, 40);
  assert(Math.abs(Date.parse(attempt.expires_at) - Date.now() - 150000) < 3000);
  const landmarkWin = finishArgs(attempt.attempt_id, 'won', 0, 20);
  denied(await rival.rpc('landmark_finish', landmarkWin), 'expired');
  denied(await rpc('landmark_finish', { ...landmarkWin, p_gold_used: 22 }), 'no_balls');
  denied(await rpc('landmark_finish', { ...landmarkWin, p_gold_used: 19 }), 'not_enough_damage');
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
  assert(legacy.cracks < 40);
  const resumedLandmark = await landmark();
  assert.equal(resumedLandmark.attempt_id, attempt.attempt_id);
  assert.equal(resumedLandmark.cracks, legacy.cracks);
  assert.equal(resumedLandmark.max_health, 40);
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

  // Give the disposable fixture wave its own clock, then move the wave and the fight
  // back together to exercise a real wave rollover without waiting for it.
  const period = JSON.parse(sql(`with added as (
    insert into private.game_wave_periods(starts_at,first_wave,minutes)
    values(clock_timestamp()-interval '4 minutes',
      (select max(first_wave) from private.game_wave_periods)
        +(select wave from private.game_wave_at(now()))+10, 5)
    returning starts_at,first_wave
  ) select row_to_json(added) from added;`));
  graceWave = period.first_wave;
  graceRevisions.push(period.starts_at);
  const stageGraceRevision = (startsAt) => sql(`insert into private.game_spawn_revisions(starts_at,config,rules,places)
    select ${literal(startsAt)},r.config,r.rules,r.places from private.game_spawn_revisions r
    where r.starts_at in (${waveTimes}) order by r.starts_at limit 1;`);
  stageGraceRevision(period.starts_at);
  const graceSpawn = fixture.spawns.common[4].split(':')[0] + ':' + graceWave;
  const graceFight = await start(graceSpawn);
  const shifted = sql(`update private.game_wave_periods p
    set starts_at=clock_timestamp()-interval '330 seconds'
    where p.first_wave=${graceWave} returning p.starts_at;`);
  graceRevisions.push(shifted);
  stageGraceRevision(shifted);
  sql(`update private.corrupted_fights
    set started_at=${literal(shifted)}::timestamptz+interval '4 minutes',
      expires_at=${literal(shifted)}::timestamptz+interval '5 minutes'
    where id=${literal(graceFight.fight_id)};`);
  assert.equal(sql(`select extract(epoch from clock_timestamp()-r.expires_at) between 30 and 35
    from private.resolve_spawn(${literal(graceSpawn.split(':')[0])},${graceWave}) r;`), 't');
  denied(await rpc('corrupted_fight_start', { p_spawn: graceSpawn, ...coords }), 'expired');
  denied(await rpc('corrupted_capsule_throw', {
    p_spawn: graceSpawn, p_ball: 'wax', p_hit: true, p_ring: 1, ...coords,
  }), 'expired');
  const graceBalance = await state();
  const lateWin = finishArgs(graceFight.fight_id, 'won', graceFight.health, 0);
  const lateResult = ok(await rpc('corrupted_fight_finish', lateWin));
  assert.equal(lateResult.result, 'won');
  assert.equal((await state()).wax_balls, graceBalance.wax_balls - graceFight.health);
  assert.deepEqual(ok(await rpc('corrupted_fight_finish', lateWin)), lateResult);
  console.log('PASS real JWT: Corrupted win 30 seconds after the wave expired and expired starts refused');
} finally {
  if (graceWave !== undefined) sql(`delete from private.game_wave_periods where first_wave=${graceWave};`);
  if (graceRevisions.length) sql(`delete from private.game_spawn_revisions where starts_at in (${graceRevisions.map(literal).join(',')});`);
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
