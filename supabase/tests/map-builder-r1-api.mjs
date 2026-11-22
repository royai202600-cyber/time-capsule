// Run against the local Time Capsule stack with the R1 migration loaded.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const { ADMIN_TEST_ANON_KEY: anon, ADMIN_TEST_SERVICE_KEY: service } = process.env;
assert(anon && service, 'Supply the local Supabase test keys');
const base = 'http://127.0.0.1:54321';
const sql = input => execFileSync('docker', [
  'exec', '-i', 'supabase_db_time-capsule', 'psql', '-U', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1',
], { input, encoding: 'utf8' }).trim();
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const json = input => JSON.parse(sql(input));
const people = [];
const photos = [];
const refs = [];
let testPeriod;
let editor;
let player;
let post;
let spot;

function request(path, { method = 'GET', key = anon, token = key, body, mime } = {}) {
  return fetch(base + path, {
    method, headers: { apikey: key, Authorization: 'Bearer ' + token, 'Content-Type': mime ?? 'application/json' },
    body: body === undefined ? undefined : mime ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
}
async function checked(response) {
  const raw = await response.text();
  assert(response.ok, raw);
  return raw ? JSON.parse(raw) : undefined;
}
async function rpc(person, name, args) {
  return checked(await request('/rest/v1/rpc/' + name, { method: 'POST', token: person.jwt, body: args }));
}
async function person(role) {
  const email = 'map-builder-r1-' + role + '-' + randomUUID() + '@example.invalid';
  const password = randomUUID();
  const user = await checked(await request('/auth/v1/admin/users', {
    method: 'POST', key: service, body: { email, password, email_confirm: true },
  }));
  const fixture = { id: user.id };
  people.push(fixture);
  const session = await checked(await request('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password },
  }));
  fixture.jwt = session.access_token;
  sql(`insert into public.profiles(id,name) values (${quote(fixture.id)},'Map builder R1 test') on conflict do nothing;`);
  return fixture;
}

const readClock = () => json('select row_to_json(w) from private.game_wave_at(clock_timestamp()) w;');
const image = readFileSync(new URL('../../public/art/game/wheel/scene-park.webp', import.meta.url));
const object = path => '/storage/v1/object/waypost-photos/' + path;

try {
  editor = await person('editor');
  player = await person('player');
  sql(`insert into private.admin_members(user_id,role) values (${quote(editor.id)},'admin');`);
  const path = 'taipei/' + randomUUID() + '.webp';
  const upload = (who, path, body, mime) =>
    request(object(path), { method: 'POST', token: who.jwt, body, mime });

  const playerUpload = await upload(player, path, image, 'image/webp');
  assert(!playerUpload.ok && /row.level security/i.test(await playerUpload.text()));
  const badPath = await upload(editor, 'taipei/invalid-name.webp', image, 'image/webp');
  assert(!badPath.ok && /row.level security/i.test(await badPath.text()));
  const png = await upload(editor, path, image, 'image/png');
  assert(!png.ok && /mime/i.test(await png.text()));
  const oversized = await upload(editor, path, Buffer.alloc(2097153), 'image/webp');
  assert(!oversized.ok && /size|limit|large/i.test(await oversized.text()));
  await checked(await upload(editor, path, image, 'image/webp'));
  photos.push(path);
  const publicPhoto = await fetch(base + '/storage/v1/object/public/waypost-photos/' + path);
  assert.equal(publicPhoto.status, 200);
  assert.deepEqual(Buffer.from(await publicPhoto.arrayBuffer()), image);

  // Pick an isolated point inside Taipei so the player sees this fixture
  // regardless of the other candidates in the 100 m spawn selection.
  const coords = json(`select row_to_json(p) from (
    select 25.062 + i*0.0005 as p_lat, 121.552 + j*0.0005 as p_lng, 10 as p_accuracy
    from generate_series(-3,3) i cross join generate_series(-3,3) j
    where private.admin_inside_border('taipei',25.062 + i*0.0005,121.552 + j*0.0005)
    and not exists (select from public.corrupted_spots s where s.hidden_at is null
      and public.distance_m(s.lat,s.lng,25.062 + i*0.0005,121.552 + j*0.0005) <= 110)
    order by abs(i)+abs(j),i,j limit 1
  ) p;`);
  const position = { p_region:'taipei', p_lat:coords.p_lat, p_lng:coords.p_lng };
  post = (await rpc(editor, 'admin_waypost_add', {
    ...position, p_name_zh:'測試', p_name_en:'R1 JWT fixture', p_scene:'park', p_photo:path,
  })).id;
  refs.push(post);
  let nearby = await rpc(player, 'game_nearby', coords);
  assert.equal(nearby.wayposts.find(p => p.id === post)?.photo, path);
  assert.equal((await rpc(player, 'waypost_rack', { waypost_id:post })).photo, path);
  await rpc(editor, 'admin_waypost_set_visible', { p_id:post, p_visible:false });
  nearby = await rpc(player, 'game_nearby', coords);
  assert(!nearby.wayposts.some(p => p.id === post));
  assert.equal((await rpc(player, 'waypost_rack', { waypost_id:post })).photo, null);

  // Shorten the local wait if needed by starting the next numbered game wave
  // 15 seconds from now. No spawn settings or production clock are changed.
  let clock = readClock();
  if (Date.parse(clock.ends_at) - Date.now() < 4000) {
    await delay(Math.max(0, Date.parse(clock.ends_at) - Date.now() + 300));
    clock = readClock();
  }
  let nextAt = clock.ends_at;
  if (Date.parse(nextAt) - Date.now() > 20000) {
    testPeriod = sql(`insert into private.game_wave_periods(starts_at,first_wave,minutes)
      values(clock_timestamp()+interval '15 seconds',${clock.wave + 1},10)
      returning starts_at;`);
    nextAt = testPeriod;
  }
  assert.equal(Number(sql(`select (private.game_spawn_at(${quote(nextAt)})).config.spawn_chance;`)), 1,
    'The local fixture expects the normal 100% per-spot release chance');
  const added = await rpc(editor, 'admin_spot_add', { ...position, p_habitat:'square' });
  spot = added.id;
  refs.push(spot);
  assert.equal(added.first_spawn_wave, clock.wave + 1);
  const isFixture = s => s.spawn_id.startsWith(spot + ':');
  assert(!(await rpc(player, 'game_nearby', coords)).spawns.some(isFixture));
  await delay(Math.max(0, Date.parse(nextAt) - Date.now() + 350));
  assert.equal(readClock().wave, clock.wave + 1);
  const releases = (await rpc(player, 'game_nearby', coords)).spawns;
  assert(releases.some(s => s.spawn_id === spot + ':' + (clock.wave + 1)));
  console.log('PASS: local real JWT upload and public download, photo and hidden Waypost, current-wave exclusion and next-wave spawn');
} finally {
  if (photos.length) {
    await checked(await request('/storage/v1/object/waypost-photos', {
      method:'DELETE', token:editor.jwt, body:{ prefixes:photos },
    }));
  }
  if (people.length) {
    const actors = people.map(p => quote(p.id)).join(',');
    const cleanup = [
      testPeriod && `delete from private.game_wave_periods where starts_at=${quote(testPeriod)};`,
      post && `delete from public.public_capsule_spots where id=${quote(post)} and source_ref='admin:'||id;`,
      spot && `delete from public.corrupted_spots where id=${quote(spot)} and source_ref='admin:'||id;`,
      `delete from private.admin_members where user_id in (${actors});`,
      'alter table private.admin_actions disable trigger admin_audit_append_only;',
      `delete from private.admin_actions where actor in (${actors});`,
      'alter table private.admin_actions enable trigger admin_audit_append_only;',
    ].filter(Boolean).join('\n');
    sql('begin;\n' + cleanup + '\ncommit;');
    for (const p of people) {
      if (p.jwt) await checked(await request('/auth/v1/logout', { method:'POST', token:p.jwt }));
      await checked(await request('/auth/v1/admin/users/' + p.id, { method:'DELETE', key:service }));
    }
    assert.equal(sql(`select count(*) from auth.users where id in (${actors});`), '0');
    assert.equal(sql(`select count(*) from public.profiles where id in (${actors});`), '0');
  }
  if (refs.length) {
    const targets = refs.map(quote).join(',');
    assert.equal(sql(`select (select count(*) from public.public_capsule_spots where id in (${targets}))
      + (select count(*) from public.corrupted_spots where id in (${targets}));`),'0');
  }
  if (photos.length) assert.equal(sql(`select count(*) from storage.objects where bucket_id='waypost-photos'
    and name in (${photos.map(quote).join(',')});`),'0');
}
