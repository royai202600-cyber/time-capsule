// Explicit live integration check. Uses only generated fixture users/objects;
// their exact IDs bound every cleanup. No real account/content is read or changed.
// Run from repo root: node mobile/scripts/test-voice-storage.mjs --live --audio /path/test.m4a
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

assert(process.argv.includes('--live'), 'Live fixtures require --live');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
process.loadEnvFile(join(root, 'mobile/.env.local'));
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ref = 'uzimuygyxwraybsipeij';
assert.equal(new URL(url).hostname, `${ref}.supabase.co`, 'Unexpected target project');
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const audioIndex = process.argv.indexOf('--audio');
assert(audioIndex >= 0, 'Pass an actual small MP4/M4A fixture with --audio');
const audio = readFileSync(process.argv[audioIndex + 1]);
assert(audio.length < 2 * 1024 * 1024, 'Fixture exceeds bucket limit');
const work = mkdtempSync(join(tmpdir(), 'timecapsule-v1-'));
const run = randomUUID();
const users = ['sender', 'recipient', 'other'].map(role => ({ role, id: randomUUID(), email: `v1-${run}-${role}@example.invalid`, password: randomBytes(24).toString('base64url') }));
const clients = [];
const paths = new Set();
const results = [];
const q = value => `'${String(value).replaceAll("'", "''")}'`;
function cli(args, label) {
  const r = spawnSync('npx', ['supabase@3.0.0', '--yes', ...(args[0] === 'storage' ? ['--experimental'] : []), ...args], { cwd: root, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
  if (r.status !== 0) {
    // These files may contain fixture credentials; never print raw CLI errors.
    writeFileSync(join(work, `${label}.log`), `${r.stdout}\n${r.stderr}`, { mode: 0o600 });
    throw new Error(`${label} failed; protected diagnostics: ${work}`);
  }
  return r.stdout;
}
function sql(text, label) {
  const file = join(work, `${label}.sql`);
  writeFileSync(file, text, { mode: 0o600 });
  return cli(['db', 'query', `--remote=${ref}`, '--file', file], label);
}
function object(user = users[0], ext = 'm4a') { const path = `${user.id}/${randomUUID()}.${ext}`; paths.add(path); return path; }
const store = client => client.storage.from('voice-notes');
const upload = (client, path, body = audio, contentType = 'audio/mp4') => store(client).upload(path, body, { contentType, upsert: false });
async function ok(label, action) { await action(); results.push({ check: label, passed: true }); console.log(`PASS ${label}`); }
const denied = result => assert(result.error, 'Expected denied operation');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sender = users[0], recipient = users[1], other = users[2];
let setup = false;
let cleaned = false;
try {
  const insert = users.map(u => `insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values (${q(u.id)},'00000000-0000-0000-0000-000000000000','authenticated','authenticated',${q(u.email)},extensions.crypt(${q(u.password)},extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','');
insert into auth.identities (provider_id,user_id,identity_data,provider,created_at,updated_at) values (${q(u.id)},${q(u.id)},${q(JSON.stringify({ sub: u.id, email: u.email }))}::jsonb,'email',now(),now());
insert into public.profiles (id,name) values (${q(u.id)},${q(`V1 QA ${u.role}`)});`).join('\n');
  sql(`begin;\n${insert}\ninsert into public.friendships (user_id,friend_id) values (${q(sender.id)},${q(recipient.id)}),(${q(recipient.id)},${q(sender.id)});\ncommit;`, 'setup');
  setup = true;
  for (const u of users) {
    const c = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await c.auth.signInWithPassword({ email: u.email, password: u.password });
    assert(!login.error, `Fixture sign-in failed: ${login.error?.message}`);
    clients.push(c);
  }
  const [a, b, c] = clients;
  const path = object();
  await ok('sender uploads own folder', async () => assert(!(await upload(a, path)).error));
  await ok('another folder and duplicate path denied', async () => { denied(await upload(a, object(recipient))); denied(await upload(a, path)); });
  await ok('invalid extension, MIME and >2 MB denied', async () => {
    denied(await upload(a, object(sender, 'txt')));
    denied(await upload(a, object(), audio, 'text/plain'));
    denied(await upload(a, object(), Buffer.alloc(2 * 1024 * 1024 + 1)));
  });
  async function cannotRead(client, target = path) {
    denied(await store(client).download(target));
    denied(await store(client).createSignedUrl(target, 600));
    const listed = await store(client).list(target.split('/')[0]);
    assert(listed.error || listed.data?.length === 0, 'Object leaked through listing');
  }
  await ok('sender cannot download, sign or list pending upload', () => cannotRead(a));
  const base = { p_recipient: recipient.id, p_vessel: 'dome', p_message: 'V1 security fixture', p_hint: 'V1 fixture', p_open_at: new Date(Date.now() + 3600000).toISOString() };
  await ok('send rejects foreign, missing and unowned objects and bad durations', async () => {
    denied(await a.rpc('send_capsule', { ...base, p_voice: `${recipient.id}/${randomUUID()}.m4a`, p_voice_ms: 2000 }));
    denied(await a.rpc('send_capsule', { ...base, p_voice: object(), p_voice_ms: 2000 }));
    for (const ms of [0, 499, 60001]) denied(await a.rpc('send_capsule', { ...base, p_voice: path, p_voice_ms: ms }));
    denied(await a.rpc('send_capsule', { ...base, p_voice: path }));
    denied(await a.rpc('send_capsule', { ...base, p_voice_ms: 2000 }));
    const unowned = object(); assert(!(await upload(a, unowned)).error);
    sql(`update storage.objects set owner_id=${q(recipient.id)} where bucket_id='voice-notes' and name=${q(unowned)} and owner_id=${q(sender.id)};`, 'ownership-fixture');
    denied(await a.rpc('send_capsule', { ...base, p_voice: unowned, p_voice_ms: 2000 }));
  });
  const at = Date.now() + 3000;
  const sent = await a.rpc('send_capsule', { ...base, p_open_at: new Date(at).toISOString(), p_voice: path, p_voice_ms: 2000 });
  assert(!sent.error, sent.error?.message); const id = sent.data;
  await ok('recipient and third party cannot sign/read before opening', async () => { await cannotRead(b); await cannotRead(c); await cannotRead(a); });
  await ok('sealed contents stay unavailable through the table API', async () => {
    for (const client of clients) { const r = await client.from('capsule_contents').select('voice_path').eq('capsule_id', id); assert(r.error || r.data?.length === 0); }
  });
  await ok('has_voice is non-secret metadata', async () => { const r = await b.from('capsules').select('has_voice').eq('id', id).single(); assert.equal(r.data?.has_voice, true); });
  await ok('time lock still enforced for a capsule without voice', async () => {
    const r = await a.rpc('send_capsule', base); assert(!r.error, r.error?.message);
    const opening = await b.rpc('open_capsule', { p_id: r.data }); denied(opening); assert.equal(opening.error.hint, 'locked');
  });
  await sleep(Math.max(0, at - Date.now() + 200));
  await ok('recipient can open and sign; simultaneous opens preserve first timestamp', async () => {
    const opened = await Promise.all([b.rpc('open_capsule', { p_id: id }), b.rpc('open_capsule', { p_id: id })]);
    for (const r of opened) { assert(!r.error, r.error?.message); assert.equal(r.data[0].voice_path, path); assert.equal(r.data[0].voice_ms, 2000); }
    assert.equal(opened[0].data[0].opened_at, opened[1].data[0].opened_at);
    const signed = await store(b).createSignedUrl(path, 600); assert(!signed.error, signed.error?.message);
    const response = await fetch(signed.data.signedUrl); assert.equal(response.status, 200); assert.deepEqual(Buffer.from(await response.arrayBuffer()), audio);
  });
  await ok('sender and third party still cannot download, sign or list after opening', async () => { await cannotRead(a); await cannotRead(c); denied(await c.rpc('open_capsule', { p_id: id })); });
  await ok('attached path cannot be reused', async () => denied(await a.rpc('send_capsule', { ...base, p_voice: path, p_voice_ms: 2000 })));
  await ok('no client can replace or delete the sealed object', async () => {
    for (const client of [a, b]) {
      denied(await store(client).update(path, audio, { contentType: 'audio/mp4' }));
      const removal = await store(client).remove([path]); assert(removal.error || removal.data?.length === 0);
    }
    assert(!(await store(b).download(path)).error);
  });
  await ok('self-capsule is unreadable before opening and readable as recipient afterwards', async () => {
    const selfPath = object(); assert(!(await upload(a, selfPath)).error);
    const when = Date.now() + 1500;
    const r = await a.rpc('send_capsule', { ...base, p_recipient: sender.id, p_open_at: new Date(when).toISOString(), p_voice: selfPath, p_voice_ms: 2000 }); assert(!r.error, r.error?.message);
    await cannotRead(a, selfPath); await sleep(Math.max(0, when - Date.now() + 200));
    const opened = await a.rpc('open_capsule', { p_id: r.data }); assert(!opened.error, opened.error?.message);
    assert(!(await store(a).createSignedUrl(selfPath, 600)).error);
  });
  await ok('concurrent sends attach an upload only once', async () => {
    const racePath = object(); assert(!(await upload(a, racePath)).error);
    const r = await Promise.all([a.rpc('send_capsule', { ...base, p_voice: racePath, p_voice_ms: 2000 }), a.rpc('send_capsule', { ...base, p_voice: racePath, p_voice_ms: 2000 })]);
    assert.equal(r.filter(x => !x.error).length, 1); assert.equal(r.filter(x => x.error).length, 1);
  });
  await ok('voice-less opening retains place/GPS checks and returns null voice fields', async () => {
    const places = await a.from('places').select('*'); assert(!places.error);
    const place = places.data.find(p => p.name_en.includes('Clock Tower')); assert(place);
    const when = Date.now() + 1500;
    const r = await a.rpc('send_capsule', { ...base, p_open_at: new Date(when).toISOString(), p_place: place.id }); assert(!r.error, r.error?.message);
    await sleep(Math.max(0, when - Date.now() + 200));
    for (const [coords, hint] of [[{}, 'no_location'], [{ p_lat: 91, p_lng: 0, p_accuracy: 10 }, 'no_location'], [{ p_lat: place.lat, p_lng: place.lng, p_accuracy: 0 }, 'inaccurate'], [{ p_lat: 0, p_lng: 0, p_accuracy: 10 }, 'far']]) {
      const attempt = await b.rpc('open_capsule', { p_id: r.data, ...coords }); denied(attempt); assert.equal(attempt.error.hint, hint);
    }
    const opened = await b.rpc('open_capsule', { p_id: r.data, p_lat: place.lat, p_lng: place.lng, p_accuracy: 10 }); assert(!opened.error, opened.error?.message);
    assert.equal(opened.data[0].voice_path, null); assert.equal(opened.data[0].voice_ms, null);
  });
} finally {
  // Storage metadata is never deleted through SQL: remove the actual blobs via
  // the authenticated admin CLI, bounded to these generated fixture folders.
  const listed = JSON.parse(sql(`select name from storage.objects where bucket_id='voice-notes' and split_part(name,'/',1) in (${users.map(u => q(u.id)).join(',')});`, 'fixture-objects'));
  const ownedPaths = listed.rows.map(row => row.name);
  assert(ownedPaths.every(p => users.some(u => p.startsWith(`${u.id}/`))), 'Cleanup escaped fixture folders');
  if (ownedPaths.length) cli(['storage', 'rm', `--remote=${ref}`, ...ownedPaths.map(p => `ss:///voice-notes/${p}`)], 'storage-cleanup');
  for (const c of clients) await c.auth.signOut({ scope: 'global' });
  if (setup) sql(`delete from auth.users where id in (${users.map(u => q(u.id)).join(',')}) and email like ${q(`v1-${run}-%@example.invalid`)};`, 'user-cleanup');
  cleaned = true;
  mkdirSync(join(root, 'docs/review/v1'), { recursive: true });
  writeFileSync(join(root, 'docs/review/v1/backend-security.json'), JSON.stringify({ project: ref, completed: results.length === 16, checks: results, fixtureUsersRemoved: cleaned, fixtureObjectsRemoved: ownedPaths.length, usedServiceRoleForAssertions: false }, null, 2) + '\n');
  rmSync(work, { recursive: true });
  console.log('CLEANUP generated fixture objects and users removed');
}
