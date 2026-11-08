// Run only after Roy approves and the game migration is applied.
// Usage: EXPO_PUBLIC_SUPABASE_URL=... EXPO_PUBLIC_SUPABASE_ANON_KEY=...
//   node supabase/tests/time-capsule-game-api.mjs /path/to/disposable-user.json
// Fixture: {"email":"...","password":"..."} for a fresh confirmed user.
// Admin setup must add this user to private.game_speed_allowlist; deleting the
// disposable user cascades that row away. Never use Roy's personal account.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(new URL('../../mobile/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
assert.equal(new URL(url).hostname, 'uzimuygyxwraybsipeij.supabase.co');
assert(key, 'publishable key required');
const fixture = JSON.parse(readFileSync(process.argv[2], 'utf8'));
assert(fixture.email?.endsWith('@example.invalid'), 'disposable test user required');
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const rpc = (name, args = {}) => client.rpc(name, args);
const ok = ({ data, error }) => {
  assert.ifError(error);
  return data;
};
try {
  const session = ok(await client.auth.signInWithPassword(fixture));
  assert(session.session?.access_token, 'real JWT required');
  const initial = ok(await rpc('game_state'))[0];
  assert.equal(initial.wax_balls, 30);
  assert.equal(initial.gold_balls, 2);
  assert((await anon.rpc('game_state')).error, 'anonymous game RPC must be denied');
  assert((await client.from('capsule_contents').select('*')).error,
    'sealed contents must remain unreadable');

  // The fixture is allow-listed so it can visit launch cities immediately.
  const positions = [
    [25.037546, 121.562754],
    [1.286798, 103.854301],
    [22.19383, 113.53999],
  ];
  let spawn;
  for (const [p_lat, p_lng] of positions) {
    const nearby = ok(await rpc('corrupted_nearby', { p_lat, p_lng, p_accuracy: 10 }));
    spawn = nearby.spawns.find(s => !s.already_caught && s.attempts_left > 0
      && new Date(s.expires_at).getTime() - Date.now() > 120000);
    if (spawn) break;
  }
  assert(spawn, 'no active spawn near the three launch centres in this wave');
  const p = { p_lat: spawn.lat, p_lng: spawn.lng, p_accuracy: 10 };
  const throws = await Promise.all(Array.from({ length: 5 }, () =>
    rpc('corrupted_throw', {
      p_spawn: spawn.spawn_id, ...p, p_ball: 'gold', p_ring: 0, p_hit: false,
    })));
  assert.equal(throws.filter(r => !r.error && r.data[0].result === 'miss').length, 2,
    'exactly two concurrent calls should spend the two starting gold balls');
  assert.equal(throws.filter(r => r.error?.message.includes('no_balls')).length, 3,
    'remaining concurrent calls should receive no_balls');
  const afterThrows = ok(await rpc('game_state'))[0];
  assert.equal(afterThrows.gold_balls, 0);
  assert.equal(afterThrows.wax_balls, 30);

  const nearby = ok(await rpc('corrupted_nearby', p));
  const common = nearby.wayposts.find(w => w.kind === 'common'
    && Math.abs(w.lat - spawn.lat) < 0.00001
    && Math.abs(w.lng - spawn.lng) < 0.00001);
  assert(common, 'spawn spot should also be a common Waypost');
  const spinArgs = { p_id: common.id, p_lat: common.lat,
    p_lng: common.lng, p_accuracy: 10 };
  const spins = await Promise.all([
    rpc('waypost_spin', spinArgs), rpc('waypost_spin', spinArgs),
  ]);
  assert.equal(spins.filter(r => !r.error).length, 1,
    'one concurrent spin should succeed');
  assert.equal(spins.filter(r => r.error?.message.includes('cooldown')).length, 1,
    'one concurrent spin should be on cooldown');
  const award = spins.find(r => !r.error).data[0];
  const afterSpin = ok(await rpc('game_state'))[0];
  assert.equal(afterSpin.wax_balls, 30 + award.wax_awarded);
  assert.equal(afterSpin.gold_balls, award.gold_awarded);
  console.log('PASS: real JWT, sealed access, concurrent ball spend and Waypost cooldown');
} finally {
  await client.auth.signOut();
}
