// Run against the local Supabase stack with ANON_KEY and SERVICE_ROLE_KEY from supabase status.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const { ANON_KEY: anon, SERVICE_ROLE_KEY: service } = process.env;
assert(anon && service, 'Set the local Supabase keys');
const root = 'http://127.0.0.1:54321';
const sql = query => execFileSync('docker', [
  'exec', '-i', 'supabase_db_time-capsule', 'psql', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1',
], { input: query, encoding: 'utf8' }).trim();

async function request(path, { token = anon, key = anon, method = 'GET', body } = {}) {
  const response = await fetch(root + path, { method,
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  return { ok: response.ok, data: raw ? JSON.parse(raw) : null };
}
function ok(response) {
  assert(response.ok, JSON.stringify(response.data));
  return response.data;
}
const admin = (path, method, body) => request('/auth/v1/admin/users' + path, { key: service, token: service, method, body });
const rpc = (fn, token, body) => request('/rest/v1/rpc/' + fn, { method: 'POST', token, body });
const today = async token => ok(await rpc('city_puzzle_today', token));
const guess = (token, city, usd) => rpc('city_puzzle_guess', token, { p_city: city, p_usd: usd });
const state = async token => ok(await rpc('game_state', token))[0];
const users = [];
const objectName = `qa-${randomUUID()}.jpg`;
const storage = '/storage/v1/object';
const jpeg = readFileSync(new URL('../assets/city-puzzle/taipei-pearl-milk-tea.jpg', import.meta.url));
let uploaded = false;

function uploadPhoto(key, token) {
  return fetch(root + storage + '/city-puzzle/' + objectName, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' },
    body: jpeg,
  });
}

function visualFields(puzzle) {
  return {
    venue_zh: puzzle.venue_zh, venue_en: puzzle.venue_en,
    photo: puzzle.photo, vessel: puzzle.vessel,
  };
}

async function createPlayer() {
  const email = `city-puzzle-${randomUUID()}@example.invalid`;
  const password = randomUUID();
  const player = ok(await admin('', 'POST', { email, password, email_confirm: true }));
  users.push(player);
  player.jwt = ok(await request('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password },
  })).access_token;
  assert.match(player.id, /^[a-f0-9-]{36}$/);
  sql(`insert into public.profiles (id, name) values ('${player.id}', 'Puzzle JWT test')
    on conflict (id) do nothing;`);
  return player;
}

try {
  const [a, b] = [await createPlayer(), await createPlayer()];
  assert.equal((await rpc('city_puzzle_today', anon)).ok, false);
  for (const table of ['city_puzzle_questions', 'city_puzzle_plays']) {
    assert.equal((await request('/rest/v1/' + table, { token: a.jwt })).ok, false);
    assert.equal((await request('/rest/v1/' + table, { token: a.jwt, method: 'POST', body: {} })).ok, false);
  }

  for (const token of [anon, a.jwt]) {
    const blocked = await uploadPhoto(anon, token);
    assert.equal(blocked.ok, false, 'client can write to the public photo bucket');
    assert.match(await blocked.text(), /access|permission|policy|unauthorized/i);
  }
  const stored = await uploadPhoto(service, service);
  assert(stored.ok, await stored.text());
  uploaded = true;
  const publicObject = await fetch(root + storage + '/public/city-puzzle/' + objectName);
  assert(publicObject.ok, 'photo URL loads without a JWT');
  assert.match(publicObject.headers.get('content-type'), /^image\/jpeg/);
  assert.deepEqual(Buffer.from(await publicObject.arrayBuffer()), jpeg);

  const day = await today(a.jwt);
  assert.equal(day.streak, 0);
  assert.deepEqual(day, await today(b.jwt));
  assert.deepEqual(day.puzzles.map(p => p.city), ['taipei', 'hongkong', 'macau', 'singapore']);
  for (const p of day.puzzles) {
    assert.deepEqual(Object.keys(p).sort(), [
      'answer', 'city', 'currency', 'done', 'guesses', 'no', 'photo', 'question_en',
      'question_zh', 'rate', 'reward', 'venue_en', 'venue_zh', 'vessel', 'won',
    ]);
    assert.equal(p.answer, null);
    assert.equal(p.reward, null);
    assert.deepEqual(p.guesses, []);
    assert(p.venue_zh.trim() && p.venue_en.trim());
    if (p.photo === null) {
      assert(p.vessel, 'questions without photos have a vessel');
    } else {
      assert.deepEqual(Object.keys(p.photo).sort(), ['credit', 'license', 'link', 'url']);
      assert(p.photo.credit.trim());
      assert.match(p.photo.license, /^CC0$|^CC BY(?:-SA)? [1-4]\.[05]$/);
      assert.match(p.photo.link, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      assert.match(p.photo.url, /\/storage\/v1\/object\/public\/city-puzzle\/[a-z0-9-]+\.jpg$/);
    }
  }

  for (const value of [null, -1, 0, 1000000.01, 1.001]) {
    assert.equal((await guess(a.jwt, 'taipei', value)).data.message, 'bad_guess');
  }

  const answers = JSON.parse(sql(`select json_object_agg(city, round(local_price / usd_rate, 2))
    from unnest(array['taipei', 'hongkong', 'macau', 'singapore']) cities(city_id)
    cross join lateral private.city_puzzle_question(city_id, private.city_puzzle_date(now()));`));
  const cents = value => Math.round(value * 100) / 100;
  const answer = answers.taipei;
  const base = (await state(a.jwt)).wax_balls;
  for (const [amount, hint, close] of [
    [cents(answer * 0.5), 'higher', false],
    [cents(answer * 2), 'lower', false],
    [cents(answer * 0.8), 'higher', true],
  ]) {
    const result = ok(await guess(a.jwt, 'taipei', amount));
    assert.deepEqual(result.puzzle.guesses.at(-1), { usd: amount, hint, close });
    assert.equal(result.puzzle.answer, null);
    assert.deepEqual(visualFields(result.puzzle), visualFields(day.puzzles[0]));
    assert.equal(result.state, null);
  }

  const submitTogether = (city, usd, count) =>
    Promise.all(Array.from({ length: count }, () => guess(a.jwt, city, usd)));
  const wins = await submitTogether('taipei', answer, 6);
  const won = wins.filter(x => x.ok).map(x => x.data);
  assert.equal(won.length, 1);
  assert(wins.filter(x => !x.ok).every(x => x.data.message === 'already_done'));
  assert.equal(won[0].puzzle.guesses.length, 4);
  assert.equal(won[0].puzzle.guesses.at(-1).hint, 'solved');
  assert.equal(won[0].puzzle.answer.usd, answer);
  assert.match(won[0].puzzle.answer.source, /^https:\/\//);
  assert.equal(won[0].puzzle.reward, 3);
  assert.deepEqual(visualFields(won[0].puzzle), visualFields(day.puzzles[0]));
  assert.equal(won[0].state.wax_balls, base + 3);
  assert.equal(won[0].streak, 1);

  const misses = await submitTogether('hongkong', 1000000, 10);
  const accepted = misses.filter(x => x.ok).map(x => x.data);
  assert.equal(accepted.length, 6);
  assert(misses.filter(x => !x.ok).every(x => x.data.message === 'already_done'));
  const finished = accepted.filter(r => r.puzzle.done);
  assert.equal(finished.length, 1);
  assert.equal(finished[0].puzzle.guesses.length, 6);
  assert.equal(finished[0].puzzle.won, false);
  assert.equal(finished[0].puzzle.reward, 1);
  assert.deepEqual(visualFields(finished[0].puzzle), visualFields(day.puzzles[1]));
  assert.equal(finished[0].puzzle.answer.usd, answers.hongkong);
  assert.equal(finished[0].state.wax_balls, base + 4);
  assert.equal(finished[0].streak, 1);
  assert.deepEqual((await today(a.jwt)).puzzles.slice(0, 2), [won[0].puzzle, finished[0].puzzle]);
  assert.equal((await state(a.jwt)).wax_balls, base + 4);
  assert.deepEqual(await today(b.jwt), day);

  // Insert one prior finished date for this disposable player and reread through their JWT.
  sql(`insert into public.city_puzzle_plays (user_id, city, play_date, question_id, guesses, done, won, reward)
    select user_id, city, play_date - 1, question_id, guesses, done, won, reward
    from public.city_puzzle_plays where user_id = '${a.id}' and city = 'taipei';`);
  assert.equal((await today(a.jwt)).streak, 2);
  assert.equal((await today(b.jwt)).streak, 0);
  console.log('CE1 real JWT checks passed: privacy, validation, venue and photo payloads, read-only Storage, win and miss races, streak and user isolation.');
} finally {
  if (uploaded) {
    ok(await request(storage + '/city-puzzle', {
      key: service, token: service, method: 'DELETE', body: { prefixes: [objectName] },
    }));
  }
  for (const player of users) {
    if (player.jwt) ok(await request('/auth/v1/logout', { token: player.jwt, method: 'POST' }));
    ok(await admin('/' + player.id, 'DELETE'));
  }
  if (users.length) {
    const ids = users.map(u => `'${u.id}'`).join(', ');
    assert.equal(sql(`select (select count(*) from auth.users where id in (${ids}))
      + (select count(*) from public.city_puzzle_plays where user_id in (${ids}))
      + (select count(*) from public.player_game where user_id in (${ids}));`), '0');
  }
}
