// Live assertions use only throwaway users' JWTs and the public anon key.
// Provision three confirmed users/profiles and a bidirectional friendship for
// users 0/1 first; remove their Storage files and users afterwards as an admin.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../../mobile/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const env = Object.fromEntries(readFileSync(new URL('../../mobile/.env.local', import.meta.url), 'utf8').split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
const url = env.EXPO_PUBLIC_SUPABASE_URL, key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
assert.equal(new URL(url).hostname, 'uzimuygyxwraybsipeij.supabase.co');
const fixturePath = process.argv[2];
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
assert.equal(fixture.users.length, 3);
assert(fixture.users.every(u => /^p1-[a-f0-9]+@example\.invalid$/.test(u.email)));
const clients = fixture.users.map(() => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const [a, b, c] = clients, [sender, recipient] = fixture.users.map(u => u.id);
const checks = [], objects = fixture.objects ?? [], capsules = fixture.capsules ?? [];
const saveFixture = () => writeFileSync(fixturePath, JSON.stringify({ ...fixture, objects, capsules }), { mode: 0o600 });
async function check(name, fn) { await fn(); checks.push({ check: name, passed: true }); console.log('PASS', name); }
const ok = r => { assert.ifError(r.error); return r.data; };
const denied = r => assert(r.error, 'request unexpectedly succeeded');
const rpc = (client, name, args) => client.rpc(name, args);
const args = (extra = {}) => ({ p_recipient: recipient, p_vessel: 'envelope', p_message: '', p_hint: 'P1 API fixture', p_open_at: new Date(Date.now() + 3600000).toISOString(), p_kind: 'prediction', p_prediction: '  We will meet again.  ', ...extra });
async function send(client, input) { const id = ok(await rpc(client, 'send_capsule', input)); capsules.push(id); saveFixture(); return id; }
async function waitToOpen(at) { const ms = new Date(at).getTime() - Date.now() + 200; if (ms > 0) await new Promise(r => setTimeout(r, ms)); }
async function upload() {
  const path = `${sender}/${randomUUID()}.m4a`;
  const bytes = readFileSync(process.argv[3]);
  ok(await a.storage.from('voice-notes').upload(path, bytes, { contentType: 'audio/mp4', upsert: false }));
  objects.push(path); saveFixture(); return { path, bytes };
}
try {
  for (let i = 0; i < 3; i++) {
    const session = ok(await clients[i].auth.signInWithPassword({ email: fixture.users[i].email, password: fixture.users[i].password }));
    assert.equal(session.user.id, fixture.users[i].id);
  }
  await check('three real password sessions use the public key', async () => {});
  const locked = await send(a, args());
  await check('prediction-only send succeeds; metadata exposes kind but no prediction text', async () => {
    const rows = ok(await a.from('capsules').select('*').eq('id', locked));
    assert.equal(rows[0].kind, 'prediction'); assert.equal(rows[0].verdict, null); assert(!('prediction' in rows[0]));
  });
  await check('sender, recipient and stranger cannot read sealed content directly', async () => {
    for (const client of clients) denied(await client.from('capsule_contents').select('*').eq('capsule_id', locked));
  });
  await check('sender lookup and both records reveal nothing before opening', async () => {
    for (const client of clients) { assert.deepEqual(ok(await rpc(client, 'prediction_for_sender', { p_id: locked })), []); assert.deepEqual(ok(await rpc(client, 'prediction_record')), []); }
  });
  await check('time lock and recipient-only opening are preserved', async () => {
    const early = await rpc(b, 'open_capsule', { p_id: locked }); denied(early); assert.equal(early.error.hint, 'locked');
    denied(await rpc(a, 'open_capsule', { p_id: locked })); denied(await rpc(c, 'open_capsule', { p_id: locked }));
  });
  await check('no participant can stamp an unopened prediction', async () => {
    for (const client of clients) denied(await rpc(client, 'set_prediction_verdict', { p_id: locked, p_verdict: true }));
  });
  await check('clients cannot patch verdict, kind, open time or sealed text directly', async () => {
    denied(await a.from('capsules').update({ verdict: true, kind: 'letter', open_at: new Date().toISOString() }).eq('id', locked));
    denied(await b.from('capsule_contents').update({ prediction: 'changed' }).eq('capsule_id', locked));
  });
  await check('anonymous callers cannot execute any prediction or send/open RPC', async () => {
    for (const [name, input] of [['prediction_for_sender', { p_id: locked }], ['prediction_record', {}], ['set_prediction_verdict', { p_id: locked, p_verdict: true }], ['send_capsule', args()], ['open_capsule', { p_id: locked }]]) denied(await rpc(anon, name, input));
  });
  await check('invalid kind, absent/blank/overlong prediction and prediction on a letter are rejected', async () => {
    for (const extra of [{ p_kind: null }, { p_kind: 'other' }, { p_prediction: null }, { p_prediction: '' }, { p_prediction: ' \t\r\n ' }, { p_prediction: 'x'.repeat(141) }, { p_kind: 'letter', p_prediction: 'no' }]) denied(await rpc(a, 'send_capsule', args(extra)));
  });
  await check('friendship, vessel ownership, future time and brand-place guards are preserved', async () => {
    for (const extra of [{ p_recipient: fixture.users[2].id }, { p_vessel: 'missing' }, { p_vessel: 'musicbox' }, { p_open_at: '2000-01-01T00:00:00Z' }, { p_place: 'missing' }]) denied(await rpc(a, 'send_capsule', args(extra)));
    const brand = ok(await a.from('places').select('id').not('brand_vessel', 'is', null))[0];
    denied(await rpc(a, 'send_capsule', args({ p_place: brand.id })));
    denied(await rpc(a, 'send_capsule', args({ p_kind: 'letter', p_prediction: null, p_message: '' })));
  });
  const near = new Date(Date.now() + 4000).toISOString();
  const openedId = await send(a, args({ p_open_at: near, p_message: 'PRIVATE LETTER: recipient only', p_prediction: '\t Future forecast \n' }));
  const onlyId = await send(a, args({ p_open_at: near, p_prediction: 'x'.repeat(140) }));
  const selfId = await send(a, args({ p_open_at: near, p_recipient: sender, p_prediction: 'My future self.' }));
  const recording = await upload();
  const letterId = await send(a, { p_recipient: recipient, p_vessel: 'envelope', p_message: 'Ordinary letter with voice', p_hint: 'P1 legacy voice fixture', p_open_at: near, p_voice: recording.path, p_voice_ms: 1000 });
  await check('voice is unreadable before opening and attachment reuse/duration guards hold', async () => {
    for (const client of clients) denied(await client.storage.from('voice-notes').createSignedUrl(recording.path, 60));
    denied(await rpc(a, 'send_capsule', args({ p_voice: recording.path, p_voice_ms: 1000 })));
    denied(await rpc(a, 'send_capsule', args({ p_voice: `${recipient}/${randomUUID()}.m4a`, p_voice_ms: 1000 })));
    denied(await rpc(a, 'send_capsule', args({ p_voice: `${sender}/${randomUUID()}.m4a`, p_voice_ms: 1000 })));
    denied(await rpc(a, 'send_capsule', args({ p_voice: recording.path, p_voice_ms: 60001 })));
    denied(await rpc(a, 'send_capsule', args({ p_voice_ms: 1000 })));
  });
  await waitToOpen(near);
  let opened;
  await check('recipient opens prediction and private letter; repeated opening keeps timestamp', async () => {
    opened = ok(await rpc(b, 'open_capsule', { p_id: openedId }))[0];
    assert.equal(opened.prediction, 'Future forecast'); assert.equal(opened.message, 'PRIVATE LETTER: recipient only'); assert.equal(opened.verdict, null);
    for (const field of ['message', 'drawing', 'photo', 'opened_at', 'gift_code', 'voice_path', 'voice_ms', 'prediction', 'verdict']) assert(field in opened);
    assert.equal(ok(await rpc(b, 'open_capsule', { p_id: openedId }))[0].opened_at, opened.opened_at);
    const only = ok(await rpc(b, 'open_capsule', { p_id: onlyId }))[0]; assert.equal(only.message, null); assert.equal(only.prediction.length, 140);
  });
  await check('only recipient can change true/false/null verdict and clear its timestamp', async () => {
    denied(await rpc(a, 'set_prediction_verdict', { p_id: openedId, p_verdict: true }));
    denied(await rpc(c, 'set_prediction_verdict', { p_id: openedId, p_verdict: true }));
    for (const value of [true, false, null, true]) {
      ok(await rpc(b, 'set_prediction_verdict', { p_id: openedId, p_verdict: value }));
      const row = ok(await rpc(a, 'prediction_for_sender', { p_id: openedId }))[0];
      assert.equal(row.verdict, value); assert.equal(row.verdict_at === null, value === null);
      assert.deepEqual(Object.keys(row).sort(), ['prediction', 'verdict', 'verdict_at']); assert.equal(row.prediction, 'Future forecast');
    }
    assert.equal(ok(await rpc(b, 'open_capsule', { p_id: openedId }))[0].verdict, true);
  });
  await check('recipient and stranger cannot use sender lookup; stranger cannot see records', async () => {
    assert.deepEqual(ok(await rpc(b, 'prediction_for_sender', { p_id: openedId })), []);
    assert.deepEqual(ok(await rpc(c, 'prediction_for_sender', { p_id: openedId })), []);
    assert.deepEqual(ok(await rpc(c, 'prediction_record')), []);
  });
  await check('opened self prediction appears once with null other; roles are caller-relative', async () => {
    ok(await rpc(a, 'open_capsule', { p_id: selfId }));
    const ar = ok(await rpc(a, 'prediction_record')), br = ok(await rpc(b, 'prediction_record'));
    assert.equal(ar.filter(r => r.capsule_id === selfId).length, 1);
    assert.equal(ar.find(r => r.capsule_id === selfId).other, null);
    assert.equal(ar.find(r => r.capsule_id === selfId).role, 'sent');
    assert.equal(ar.find(r => r.capsule_id === openedId).other, recipient);
    assert.equal(ar.find(r => r.capsule_id === openedId).role, 'sent');
    assert.equal(br.find(r => r.capsule_id === openedId).other, sender);
    assert.equal(br.find(r => r.capsule_id === openedId).role, 'received');
    assert(!ar.some(r => r.capsule_id === locked)); assert(!ar.some(r => r.capsule_id === letterId));
    assert(ar.every(r => !('message' in r) && !('voice_path' in r)));
  });
  await check('legacy letter plus voice opens; sender lookup stays empty and verdict is forbidden', async () => {
    const row = ok(await rpc(b, 'open_capsule', { p_id: letterId }))[0];
    assert.equal(row.message, 'Ordinary letter with voice'); assert.equal(row.voice_path, recording.path); assert.equal(row.voice_ms, 1000); assert.equal(row.prediction, null);
    assert.deepEqual(ok(await rpc(a, 'prediction_for_sender', { p_id: letterId })), []);
    denied(await rpc(b, 'set_prediction_verdict', { p_id: letterId, p_verdict: true }));
    const signed = ok(await b.storage.from('voice-notes').createSignedUrl(recording.path, 60));
    const response = await fetch(signed.signedUrl); assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), recording.bytes);
    for (const client of [a, c]) denied(await client.storage.from('voice-notes').createSignedUrl(recording.path, 60));
    denied(await a.storage.from('voice-notes').upload(recording.path, recording.bytes, { contentType: 'audio/mp4', upsert: true }));
  });
  await check('concurrent attachment attempts accept one recording only', async () => {
    const second = await upload();
    const results = await Promise.all([rpc(a, 'send_capsule', args({ p_voice: second.path, p_voice_ms: 1000 })), rpc(a, 'send_capsule', args({ p_voice: second.path, p_voice_ms: 1000 }))]);
    assert.equal(results.filter(r => !r.error).length, 1); assert.equal(results.filter(r => r.error).length, 1);
    capsules.push(results.find(r => !r.error).data); saveFixture();
  });
  await check('ordinary letter defaults still work with the pre-voice argument shape', async () => {
    const at = new Date(Date.now() + 2000).toISOString();
    const id = await send(a, { p_recipient: sender, p_vessel: 'tin', p_message: 'Legacy ordinary letter', p_hint: 'P1 legacy fixture', p_open_at: at });
    await waitToOpen(at); const row = ok(await rpc(a, 'open_capsule', { p_id: id }))[0];
    assert.equal(row.message, 'Legacy ordinary letter'); assert.equal(row.prediction, null); assert.equal(row.voice_path, null);
  });
  const output = new URL('../../docs/review/p1/security.json', import.meta.url);
  mkdirSync(new URL('.', output), { recursive: true });
  writeFileSync(output, JSON.stringify({ project: 'uzimuygyxwraybsipeij', completed: true, checks, usedServiceRoleForAssertions: false, fixtureCleanup: 'pending' }, null, 2) + '\n');
} finally { for (const client of clients) await client.auth.signOut(); saveFixture(); }
