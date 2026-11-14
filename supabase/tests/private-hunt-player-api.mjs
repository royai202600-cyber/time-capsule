// Run against the local Supabase stack with P1 and P2 loaded.
// From the repo root: npx supabase status -o env supplies API_URL, ANON_KEY and SERVICE_ROLE_KEY.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../mobile/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const { API_URL, ANON_KEY, SERVICE_ROLE_KEY, P2_DB_CONTAINER = 'supabase_db_time-capsule' } = process.env;
assert.equal(new URL(API_URL).origin, 'http://127.0.0.1:54321', 'local Supabase only');

const client = key => createClient(API_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = client(SERVICE_ROLE_KEY);
const fixtures = [];
const ok = ({ data, error }) => {
  assert.ifError(error);
  return data;
};
const sql = statement => execFileSync('docker', [
  'exec', P2_DB_CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atc', statement,
], { encoding: 'utf8' });

async function login(name) {
  const email = `p2-${randomUUID()}@example.invalid`;
  const password = randomUUID();
  const { user } = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
  fixtures.push(user.id);
  const session = client(ANON_KEY);
  assert(ok(await session.auth.signInWithPassword({ email, password })).session.access_token);
  ok(await session.from('profiles').upsert({ id: user.id, name }));
  return { session, id: user.id };
}

try {
  const { session: owner, id: ownerId } = await login('P2 organizer');
  const { session: player, id: playerId } = await login('P2 player');
  sql(`update public.profiles set can_create_hunts = true where id = '${ownerId}'`);
  const { id } = ok(await owner.rpc('private_hunt_create', { p_draft: {
    name: 'P2 real login', description: 'GPS, QR, spin and puzzle', cover: null, route_mode: 'ordered',
    leaderboard_visible: true, starts_at: new Date(Date.now() - 60_000).toISOString(),
    ends_at: new Date(Date.now() + 3_600_000).toISOString(), time_limit_min: 15,
  } }));
  const base = { name: 'Fixture', location_lat: 25, location_lng: 121, points: 10 };
  const quests = [
    { quest_type: 'arrive', arrive_check: 'gps_qr' },
    { quest_type: 'spin' },
    { quest_type: 'puzzle', puzzle_kind: 'text', answer: 'Blue Door' },
  ];
  for (const [index, quest] of quests.entries()) {
    ok(await owner.rpc('private_hunt_quest_save', { p_hunt: id, p_quest: { ...base, ...quest, ordinal: index + 1 } }));
  }
  const { quests: ownerQuests } = ok(await owner.rpc('private_hunt_edit_state', { p_hunt: id }));
  const { join_code: code } = ok(await owner.rpc('private_hunt_publish', { p_hunt: id }));
  assert.deepEqual(ok(await player.rpc('private_hunt_preview', { p_code: code })).quests, []);
  const hunt = ok(await player.rpc('private_hunt_join_code', { p_code: code }));
  const [arrive, spin, puzzle] = hunt.quests;
  assert(!('qr_token' in arrive) && !('answer' in puzzle));
  const finish = (w, answer = null, qr = null) => player.rpc('private_hunt_quest_complete', {
    p_quest: w.id, p_lat: 25, p_lng: 121, p_accuracy: 15, p_answer: answer, p_qr: qr,
  });
  assert.equal((await finish(spin)).error.message, 'locked');
  assert.equal((await finish(arrive, null, 'wrong')).error.message, 'wrong_qr');
  assert.equal(ok(await finish(arrive, null, ownerQuests[0].qr_token.toUpperCase())).points_gained, 10);
  assert.equal(ok(await finish(spin)).points_gained, 10);
  for (let i = 0; i < 3; i++) {
    const failure = await finish(puzzle, 'wrong');
    assert.equal(failure.status, 400);
    assert.equal(failure.error.message, i === 2 ? 'no_tries' : 'wrong_answer');
    assert.equal(JSON.parse(failure.error.details).tries_left, 2 - i);
    if (i === 2) assert.equal(JSON.parse(failure.error.details).wait_s, 60);
  }
  assert.equal((await finish(puzzle, 'Blue Door')).error.message, 'no_tries');
  sql(`update public.private_hunt_members set joined_at = now() - interval '16 minutes',
    started_at = now() - interval '16 minutes' where hunt_id = '${id}' and user_id = '${playerId}'`);
  assert.equal((await finish(puzzle, 'Blue Door')).error.message, 'time_up');
  sql(`update public.private_hunt_members set joined_at = now(), started_at = now() where hunt_id = '${id}' and user_id = '${playerId}';
    update public.private_hunt_quest_progress set wait_until = now() - interval '1 second'
      where quest_id = '${puzzle.id}' and user_id = '${playerId}'`);
  const finished = ok(await finish(puzzle, '  BLUE Door！ '));
  assert(finished.hunt.finished_at);
  assert.equal(finished.hunt.points, 30);
  const board = ok(await player.rpc('private_hunt_leaderboard', { p_hunt: id }));
  assert.equal(board[0].points, 30);
  assert.equal(board[0].you, true);
  assert(ok(await player.rpc('my_passport')).some(stamp => stamp.place === id && stamp.how_earned === 'private_hunt'));
  await player.auth.signOut();
  await owner.auth.signOut();
  console.log('Real login passed: preview, join, three quests, errors, cooldown, time-up, leaderboard and stamp');
} finally {
  const results = await Promise.all(fixtures.reverse().map(id => admin.auth.admin.deleteUser(id)));
  results.forEach(ok);
  assert.equal(sql(`select count(*) from auth.users where id::text in ('${fixtures.join("','")}')`).trim(), '0');
}
