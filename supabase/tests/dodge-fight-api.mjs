// Run against a disposable Auth + PostgREST stack after the migration.
// Pass the JSON from pg_temp.dodge_fixture(). Set start_gold=12 in that database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const { DF_AUTH_URL, DF_REST_URL } = process.env;
for (const url of [DF_AUTH_URL, DF_REST_URL]) {
  assert(url && !new URL(url).hostname.endsWith('.supabase.co'), 'Use the disposable test stack');
}
const fixture = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { common, uncommon, rare } = fixture.spawns;
const coords = { p_lat: fixture.lat, p_lng: fixture.lng, p_accuracy: 10 };

async function call(url, body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const bodyText = await response.text();
  return { ok: response.ok, data: bodyText ? JSON.parse(bodyText) : null };
}

function ok(response) {
  assert(response.ok, JSON.stringify(response.data));
  return response.data;
}

function denied(response, reason) {
  assert.equal(response.ok, false, 'Request should have been refused');
  assert.equal(response.data.message, reason);
}

async function signup() {
  const creds = { email: `df1-${randomUUID()}@example.com`, password: `Df1+${randomUUID()}` };
  ok(await call(`${DF_AUTH_URL}/signup`, { ...creds, data: { full_name: 'DF1 test' } }));
  const session = ok(await call(`${DF_AUTH_URL}/token?grant_type=password`, creds));
  assert.equal(session.access_token.split('.').length, 3);
  ok(await call(`${DF_REST_URL}/profiles`, { id: session.user.id, name: 'DF1 test' }, session.access_token));
  return (name, args = {}) => call(`${DF_REST_URL}/rpc/${name}`, args, session.access_token);
}

const [player, rival] = await Promise.all([signup(), signup()]);
const [timeout] = ok(await rival('landmark_start', { p_waypost: fixture.waypost, ...coords }));
const state = async () => ok(await player('game_state'))[0];
const start = async (spawn) => ok(await player('corrupted_fight_start', { p_spawn: spawn, ...coords }))[0];
const hit = (fight, ball = 'wax') => player('corrupted_fight_throw', { p_fight: fight, p_ball: ball, ...coords });
const lose = (fight) => player('corrupted_fight_loss', { p_fight: fight, ...coords });
const landmarkStart = async () => ok(await player('landmark_start', { p_waypost: fixture.waypost, ...coords }))[0];
const landmarkHit = (attempt, ball, ring) => player('landmark_hit',
  { p_attempt: attempt, p_ball: ball, p_ring: ring, ...coords });

let expectedWax = (await state()).wax_balls;
for (const [spawn, hp] of [[common[0], 3], [uncommon[0], 4], [rare[0], 5]]) {
  const fight = await start(spawn);
  assert.equal(fight.health, hp);
  assert.equal(fight.max_health, hp);
  denied(await rival('corrupted_fight_throw', { p_fight: fight.fight_id, p_ball: 'wax', ...coords }), 'expired');
  for (let i = 1; i <= hp; i++) {
    const [out] = ok(await hit(fight.fight_id));
    assert.equal(out.wax_balls, --expectedWax);
    assert.equal(out.health, hp-i);
    assert.equal(out.result, i === hp ? 'restored' : 'hit');
    if (i === 1) {
      denied(await hit(fight.fight_id), 'too_soon');
      assert.equal((await state()).wax_balls, expectedWax);
      const resumed = await start(spawn);
      assert.equal(resumed.fight_id, fight.fight_id);
      assert.equal(resumed.health, hp-1);
    }
    if (i < hp) await delay(820);
    else {
      assert(out.is_new && out.copies > 0 && out.stars === 1 && out.xp_gained > 0);
      denied(await hit(fight.fight_id), 'expired');
    }
  }
}
console.log('PASS real JWT: 3/4/5 wax hits, restore rewards, spacing, resume and ownership');

let fight = await start(common[1]);
const [gold] = ok(await hit(fight.fight_id, 'gold'));
assert.equal(gold.health, 1);
assert.equal(gold.gold_balls, 11);
for (let tries = 2; tries >= 0; tries--) {
  const [loss] = ok(await lose(fight.fight_id));
  assert.deepEqual(loss, { result: 'lost', attempts_left: tries });
  denied(await lose(fight.fight_id), 'expired');
  if (tries > 0) {
    const next = await start(common[1]);
    assert.notEqual(next.fight_id, fight.fight_id);
    assert.equal(next.health, 3);
    fight = next;
  }
}
denied(await player('corrupted_fight_start', { p_spawn: common[1], ...coords }), 'no_attempts');
assert.equal((await state()).gold_balls, 11);
const legacy = (hitTarget) => player('corrupted_capsule_throw', {
  p_spawn: common[2], p_ball: 'wax', p_ring: 1, p_hit: hitTarget, ...coords,
});
assert.equal(ok(await legacy(false))[0].result, 'miss');
assert.equal(ok(await legacy(true))[0].result, 'restored');
console.log('PASS real JWT: gold damage, loss and reset, last try, legacy Corrupted RPC');

let attempt = await landmarkStart();
assert.equal(attempt.cracks, 20);
assert(Math.abs(Date.parse(attempt.expires_at) - Date.now() - 150_000) < 3000);
const [legacyHit] = ok(await landmarkHit(attempt.attempt_id, 'wax', 1));
assert.equal(legacyHit.cracks, 19);
denied(await landmarkHit(attempt.attempt_id, 'gold'), 'too_soon');
for (let i = 1; i <= 10; i++) {
  await delay(820);
  const [out] = ok(await landmarkHit(attempt.attempt_id, 'gold'));
  assert.equal(out.cracks, Math.max(0, 19-i*2));
  assert.equal(out.result, i === 10 ? 'won' : 'hit');
  if (i === 10) {
    assert(out.vessel && out.stars === 1 && out.copies === null && out.xp_gained > 0);
  }
}
denied(await landmarkHit(attempt.attempt_id, 'wax'), 'expired');
attempt = await landmarkStart();
const lossArgs = { p_attempt: attempt.attempt_id, ...coords };
const [loss] = ok(await player('landmark_loss', lossArgs));
assert.equal(loss.result, 'lost');
denied(await player('landmark_loss', lossArgs), 'expired');
denied(await landmarkHit(attempt.attempt_id, 'wax'), 'expired');
assert.notEqual((await landmarkStart()).attempt_id, attempt.attempt_id);
console.log('PASS real JWT: Landmark 20 health / 150 s, old signature, win and loss');

fight = await start(common[3]);
const sameFightBalance = (await state()).wax_balls;
const simultaneous = await Promise.all([hit(fight.fight_id), hit(fight.fight_id)]);
assert.equal(simultaneous.filter(r => r.ok).length, 1);
denied(simultaneous.find(r => !r.ok), 'too_soon');
assert.equal((await state()).wax_balls, sameFightBalance-1);
assert.equal((await start(common[3])).health, 2);

fight = await start(common[4]);
attempt = await landmarkStart();
assert.equal((await state()).gold_balls, 1);
const simultaneousGold = await Promise.all([hit(fight.fight_id, 'gold'), landmarkHit(attempt.attempt_id, 'gold')]);
assert.equal(simultaneousGold.filter(r => r.ok).length, 1);
denied(simultaneousGold.find(r => !r.ok), 'no_balls');
assert.equal((await state()).gold_balls, 0);
assert.equal((await start(common[4])).health, simultaneousGold[0].ok ? 1 : 3);
assert.equal((await landmarkStart()).cracks, simultaneousGold[1].ok ? 18 : 20);
console.log('PASS real JWT: same-fight spacing race and cross-fight final-ball race');

await delay(Math.max(0, Date.parse(timeout.expires_at)-Date.now()+150));
const timeoutArgs = { p_attempt: timeout.attempt_id, ...coords };
denied(await rival('landmark_hit', { ...timeoutArgs, p_ball: 'wax' }), 'expired');
denied(await rival('landmark_loss', timeoutArgs), 'expired');
const [fresh] = ok(await rival('landmark_start', { p_waypost: fixture.waypost, ...coords }));
assert.notEqual(fresh.attempt_id, timeout.attempt_id);
assert.equal(fresh.cracks, 20);
console.log('PASS real JWT: natural Landmark timeout and restart');
