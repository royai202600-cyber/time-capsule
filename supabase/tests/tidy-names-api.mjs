// Run with a disposable local Supabase stack and its status JSON path.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const { createClient } = createRequire(new URL('../../mobile/package.json', import.meta.url))('@supabase/supabase-js');
const { API_URL, ANON_KEY, SERVICE_ROLE_KEY } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
assert.equal(new URL(API_URL).hostname, '127.0.0.1');
const client = key => createClient(API_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = client(SERVICE_ROLE_KEY);
const users = [];
const sessions = [];
const ok = ({ data, error }) => { assert.ifError(error); return data; };
const sql = statement => execFileSync('docker', ['exec', '-i', 'supabase_db_time-capsule', 'psql', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'], { input: statement, encoding: 'utf8' }).trim();
async function account() {
  const email = 'tidy-' + randomUUID() + '@example.invalid', password = randomUUID();
  const { user } = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
  users.push(user.id);
  const session = client(ANON_KEY);
  ok(await session.auth.signInWithPassword({ email, password }));
  sessions.push(session);
  ok(await session.from('profiles').upsert({ id: user.id, name: 'Vocabulary verification' }));
  return { session, id: user.id };
}
try {
  const sender = await account(), recipient = await account();
  sql(`insert into public.friendships(user_id,friend_id) values ('${sender.id}','${recipient.id}'),('${recipient.id}','${sender.id}');`);
  const id = ok(await sender.session.rpc('send_capsule', {
    p_recipient: recipient.id, p_vessel: 'dome', p_message: 'Sealed verification',
    p_hint: 'Verification', p_open_at: new Date(Date.now() + 3600000).toISOString(),
  }));
  assert((await recipient.session.rpc('open_capsule', { p_id: id })).error);
  const contents = await sender.session.from('capsule_contents').select('*').eq('capsule_id', id);
  assert(contents.error || contents.data.length === 0);
  sql(`update public.capsules set open_at=now()-interval '1 second' where id='${id}';`);
  assert((await sender.session.rpc('open_capsule', { p_id: id })).error);
  ok(await recipient.session.rpc('open_capsule', { p_id: id }));
  const spot = JSON.parse(sql("select row_to_json(s) from (select lat,lng from public.public_capsule_spots where city_en='Taipei' limit 1) s;"));
  const coords = { p_lat: spot.lat, p_lng: spot.lng, p_accuracy: 10 };
  const [dropped] = ok(await sender.session.rpc('public_capsule_drop', {
    p_message: 'For whoever passes by', p_hint: 'Verification', p_vessel: 'bottle', p_drift_days: 1, ...coords,
  }));
  sql(`update public.capsules set open_at=now()-interval '1 second' where id='${dropped.id}';`);
  const place = JSON.parse(sql(`select row_to_json(s) from public.public_capsule_spots s join public.capsules c on c.public_capsule_spot=s.id where c.id='${dropped.id}';`));
  const at = { p_lat: place.lat, p_lng: place.lng, p_accuracy: 10 };
  const current = ok(await recipient.session.rpc('public_capsule_nearby', at));
  const previous = ok(await recipient.session.rpc('sea_nearby', at));
  assert(current.some(c => c.id === dropped.id));
  assert.deepEqual(current.map(({ spot_zh, spot_en, available_at, ...c }) => ({
    ...c, shore_zh: spot_zh, shore_en: spot_en, washed_up_at: available_at,
  })), previous);
  ok(await recipient.session.rpc('public_capsule_pick_up', { p_id: dropped.id, ...at }));
  ok(await recipient.session.rpc('open_capsule', { p_id: dropped.id, ...at }));
  const rows = ok(await recipient.session.from('capsules').select('is_public,sea,public_capsule_spot,shore').eq('id', dropped.id));
  assert.equal(rows[0].is_public, rows[0].sea);
  assert.equal(rows[0].public_capsule_spot, rows[0].shore);
  console.log('PASS: real JWT send/open, sender sealing, time gate, public drop/pickup/open, legacy response and capsule columns');
} finally {
  for (const session of sessions) await session.auth.signOut();
  for (const id of users) ok(await admin.auth.admin.deleteUser(id));
}
