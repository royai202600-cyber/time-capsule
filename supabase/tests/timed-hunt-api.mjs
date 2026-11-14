/** Run against disposable local Supabase with the timed-hunt migration.
 * Usage: node supabase/tests/timed-hunt-api.mjs /path/to/local-status.json
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { createClient } = createRequire(new URL('../../mobile/package.json', import.meta.url))('@supabase/supabase-js');
const { API_URL, ANON_KEY, SERVICE_ROLE_KEY } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
assert.equal(new URL(API_URL).hostname, '127.0.0.1');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(API_URL, SERVICE_ROLE_KEY, options);
const player = createClient(API_URL, ANON_KEY, options);
const ok = ({ data, error }) => { assert.ifError(error); return data; };
const rpc = async (name, args) => ok(await player.rpc(name, args));
const sql = (statement) => execFileSync('docker', [
  'exec', '-i', 'supabase_db_time-capsule', 'psql', '-U', 'postgres', '-X', '-At', '-v', 'ON_ERROR_STOP=1',
], { input: statement, encoding: 'utf8' }).trim();
const email = `hunt-${randomUUID()}@example.test`;
const password = randomUUID();
const { user } = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
const uuid = user.id;
const id = 'xinyi-2026-11';
const keeper = { p_hunt: id, p_lat: 25.037546, p_lng: 121.562754, p_accuracy: 10 };
const list = async () => (await rpc('city_hunt_list', { p_lat: keeper.p_lat, p_lng: keeper.p_lng }));
const hunt = async () => (await list()).find(h => h.id === id);
const finish = () => rpc('city_hunt_finish', keeper);
const checkIn = () => rpc('city_hunt_check_in', keeper);
const profile = `hunt_id='${id}' and user_id='${uuid}'`;
const goals = 'spin_count=3, restore_count=5, landmark_count=1';
const roster = {
  'xinyi-2026-11': 60, 'senado-square-2026-11': 45, 'hkust-2026-11': 60,
};
const baseConfig = sql(`select json_build_array(spawn_chance, visible_min_minutes, visible_max_minutes,
  restore_common, restore_uncommon, restore_rare) from private.game_config where singleton;`);
try {
  sql(`
    insert into public.profiles(id,name) values ('${uuid}','Local timed hunt') on conflict do nothing;
    insert into private.game_speed_allowlist(user_id) values ('${uuid}');
    update private.game_config set spawn_chance=1, visible_min_minutes=wave_minutes,
      visible_max_minutes=wave_minutes, restore_common=1, restore_uncommon=1, restore_rare=1;
  `);
  const login = ok(await player.auth.signInWithPassword({ email, password }));
  assert(login.session?.access_token, 'real GoTrue JWT required');

  const all = await list();
  for (const [huntId, limit] of Object.entries(roster)) {
    const h = all.find(x => x.id === huntId);
    assert.equal(h.time_limit_min, limit);
    assert.equal(h.ends_at, 'infinity');
    assert.match(h.name_zh, /城市定向$/);
  }
  const joined = await rpc('city_hunt_join', { p_hunt: id });
  assert.equal(joined.run_started_at, null);
  assert.equal(joined.finished_today, false);
  const started = await checkIn();
  assert(started.run_started_at && started.run_ends_at);
  assert.equal((await checkIn()).run_started_at, started.run_started_at, 'check-in retry keeps clock');
  assert((await player.from('hunt_runs').select('*')).error, 'run history unavailable directly');

  const coords = ({ lat, lng }) => ({ p_lat: lat, p_lng: lng, p_accuracy: 10 });
  const nearby = await rpc('game_nearby', { p_lat: 25.033263, p_lng: 121.564887, p_accuracy: 10 });
  const posts = JSON.parse(sql(`
    select json_agg(s) from (
      select p.id,p.lat,p.lng from public.public_capsule_spots p, public.hunts h
      where h.id='${id}' and p.kind='common' and p.game_enabled
        and public.distance_m(p.lat,p.lng,h.area_lat,h.area_lng)<=h.area_radius_m
      order by p.id limit 4
    ) s;
  `));
  for (const p of posts.slice(0, 3)) await rpc('waypost_spin', { p_id: p.id, ...coords(p) });
  const spawns = JSON.parse(sql(`
    select json_agg(s) from (
      select p.lat,p.lng,r.spawn_id from public.corrupted_spots p
      cross join public.hunts h cross join private.game_config c
      cross join lateral private.resolve_spawn(p.id,
        floor(extract(epoch from now())/(c.wave_minutes*60))::bigint) r
      where h.id='${id}' and public.distance_m(p.lat,p.lng,h.area_lat,h.area_lng)<=h.area_radius_m
      order by p.id limit 5
    ) s;
  `));
  assert.equal(spawns.length, 5);
  for (const s of spawns) {
    const [out] = await rpc('corrupted_capsule_throw', {
      p_spawn: s.spawn_id, ...coords(s), p_ball: 'wax', p_ring: 1, p_hit: true,
    });
    assert.equal(out.result, 'restored');
  }
  const landmark = nearby.wayposts.find(p => p.id === started.landmark);
  const [attempt] = await rpc('landmark_start', { p_waypost: landmark.id, ...coords(landmark) });
  let outcome;
  for (let i = 0; i < 30; i++) {
    [outcome] = await rpc('landmark_hit', {
      p_attempt: attempt.attempt_id, ...coords(landmark), p_ball: 'wax', p_ring: 1,
    });
    if (outcome.result === 'won') break;
  }
  assert.equal(outcome.result, 'won');
  const first = await finish();
  assert.equal(first.xp_gained, 300);
  assert.equal(first.gold_gained, 5);
  assert(first.hunt.finished_today && first.hunt.today_s >= 0);
  assert.equal(first.hunt.best_s, first.hunt.today_s);
  assert.equal((await player.rpc('city_hunt_finish', keeper)).error?.message, 'already finished');

  // Move the successful fixture to yesterday to exercise next-day and same-day timeout paths.
  sql(`
    update public.city_hunt_runs set day=day-1, started_at=started_at-interval '1 day',
      finished_at=finished_at-interval '1 day', duration_s=25 where ${profile};
    update public.city_hunt_quest_progress set joined_at=joined_at-interval '1 day',
      checked_in_at=checked_in_at-interval '1 day', finished_at=finished_at-interval '1 day' where ${profile};
  `);
  const nextDay = await hunt();
  assert.equal(nextDay.finished_today, false);
  assert.equal(nextDay.finished_at, null);
  assert.equal(nextDay.today_s, null);
  assert.equal(nextDay.best_s, 25);
  await checkIn();
  // Shorten only the local fixture's time limit to make the same-day test independent of wall time.
  sql(`update public.hunts set time_limit_min=1 where id='${id}';
    update public.city_hunt_quest_progress set checked_in_at=now()-interval '2 minutes', ${goals} where ${profile};`);
  const expired = await hunt();
  assert.equal(expired.checked_in_at, null);
  assert(Date.parse(expired.run_ends_at) < Date.now());
  assert(expired.quests.every(s => s.count === 0));
  const denied = (await player.rpc('city_hunt_finish', keeper)).error;
  assert.equal(denied?.hint, 'time_up');
  assert.equal(denied?.message, 'time_up');
  assert((await rpc('waypost_spin', { p_id: posts[3].id, ...coords(posts[3]) })).length);
  assert.equal(sql(`select spin_count from public.city_hunt_quest_progress where ${profile};`), '3');
  const restarted = await checkIn();
  assert(Date.parse(restarted.run_started_at) > Date.parse(expired.run_started_at));
  assert.equal(restarted.quests.find(s => s.key === 'spin').count, 0);
  sql(`update public.city_hunt_quest_progress set ${goals} where ${profile};`);
  const repeat = await finish();
  assert.equal(repeat.xp_gained, 50);
  assert.equal(repeat.gold_gained, 0);
  assert(repeat.hunt.finished_today && repeat.hunt.best_s < 25);
  assert.equal((await player.rpc('city_hunt_finish', keeper)).error?.message, 'already finished');
  assert.equal((await rpc('my_passport')).filter(s => s.how_earned === 'hunt').length, 1);
  console.log('PASS: real JWT Xinyi route, first finish, midnight reset, time_up, fresh run and daily repeat XP');
} finally {
  await player.auth.signOut();
  ok(await admin.auth.admin.deleteUser(uuid));
  const [chance, min, max, common, uncommon, rare] = JSON.parse(baseConfig);
  sql(`update public.hunts set time_limit_min=60 where id='${id}';
    update private.game_config set spawn_chance=${chance}, visible_min_minutes=${min}, visible_max_minutes=${max},
      restore_common=${common}, restore_uncommon=${uncommon}, restore_rare=${rare};`);
}
