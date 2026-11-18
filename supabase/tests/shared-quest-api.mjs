// Run only against a disposable copy of local Supabase with the HL-C3 migrations.
// Its Auth and REST containers are attached to the existing Supabase Docker network.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const dbContainer = 'supabase_db_time-capsule'
const authHost = 'http://tc-quest-auth:9999'
const restHost = 'http://tc-quest-rest:3000'
const database = 'tc_quest_types_verify'

const sql = statement => execFileSync('docker', ['exec', '-i', dbContainer, 'psql', '-U', 'postgres',
  '-d', database, '-qAt', '-v', 'ON_ERROR_STOP=1'], { input: statement, encoding: 'utf8' }).trim()

function request(url, body, jwt) {
  const config = [
    'silent', 'show-error', 'max-time = 15', 'write-out = "\\n%{http_code}"',
    'header = "Content-Type: application/json"',
    jwt && `header = "Authorization: Bearer ${jwt}"`,
    `url = "${url}"`,
    body !== undefined && `data = ${JSON.stringify(JSON.stringify(body))}`,
  ].filter(Boolean).join('\n')
  const raw = execFileSync('docker', ['exec', '-i', dbContainer, 'curl', '--config', '-'],
    { input: config, encoding: 'utf8' })
  const newline = raw.lastIndexOf('\n')
  const bodyText = raw.slice(0, newline)
  return { status: Number(raw.slice(newline + 1)), data: bodyText ? JSON.parse(bodyText) : null }
}

function ok(result) {
  assert(result.status >= 200 && result.status < 300, JSON.stringify(result.data))
  return result.data
}
function expectError(result, message) {
  assert(result.status >= 400)
  assert.equal(result.data.message, message)
}
const rpc = (fn, jwt, args = {}) => request(`${restHost}/rpc/${fn}`, args, jwt)
const call = (fn, jwt, args) => ok(rpc(fn, jwt, args))

function player() {
  const email = `quest-jwt-${randomUUID()}@example.invalid`
  const password = randomUUID()
  const signup = ok(request(authHost + '/signup', { email, password }))
  const session = ok(request(authHost + '/token?grant_type=password', { email, password }))
  assert.equal(signup.user.id, session.user.id)
  assert.match(session.user.id, /^[a-f0-9-]{36}$/)
  return { id: session.user.id, jwt: session.access_token }
}

const organizer = player()
const member = player()
const outsider = player()
sql(`
  insert into public.profiles(id,name,can_create_hunts) values
    ('${organizer.id}','HL-C3 JWT organizer',true),
    ('${member.id}','HL-C3 JWT member',false),
    ('${outsider.id}','HL-C3 JWT outsider',false)
  on conflict(id) do update set can_create_hunts=excluded.can_create_hunts;
  insert into private.admin_members(user_id,role) values ('${organizer.id}','admin');
  insert into private.game_speed_allowlist(user_id) values ('${member.id}');
  update private.game_config set restore_common=1 where singleton;
`)

const editor = organizer.jwt
const jwt = member.jwt
const other = outsider.jwt
const post = JSON.parse(sql(`select to_jsonb(s) from public.public_capsule_spots s where place='taipei101' and kind='landmark'`))
const loc = { p_lat: post.lat, p_lng: post.lng, p_accuracy: 10 }
const point = { location_lat: post.lat, location_lng: post.lng }
const pool = { city: 'taipei', place_zh: '測試', place_en: 'Fixture', prompt_zh: '問題', prompt_en: 'Prompt',
  source_url: 'https://example.invalid', checked_on: '2026-11-18', ...point }
function publish(entry) {
  const saved = call('admin_question_pool_save', editor, { payload: { ...pool, ...entry } })
  assert(!('answer' in saved) && !('local_amount' in saved))
  return call('admin_question_pool_set_status', editor, { id: saved.id, status: 'published' }).id
}
const textPool = publish({ type: 'question', kind: 'text', answer: 'Tea', typed_aliases: ['Oolong'] })
const pricePool = publish({ type: 'price', currency: 'NT$', rate: 32, local_amount: 320 })
assert.equal(call('city_puzzle_today', jwt).puzzles.length, 4)
expectError(rpc('admin_question_pool_list', other, { city: 'taipei' }), 'forbidden')
assert(rpc('city_hunt_quests', null, { hunt_id: 'xinyi-2026-11' }).status >= 400)

const { id: hunt } = call('private_hunt_create', editor, { p_draft: {
  name: 'HL-C3 real JWT', route_mode: 'ordered', leaderboard_visible: false,
  starts_at: new Date(Date.now() - 60_000).toISOString(),
  ends_at: new Date(Date.now() + 3_600_000).toISOString(),
  guide_mode: 'fixed', guide_lat: post.lat, guide_lng: post.lng,
} })
for (const quest of [
  { type: 'arrive', arrive_check: 'gps_qr' },
  { type: 'question', pool_id: textPool },
  { type: 'price', pool_id: pricePool },
  { type: 'catch', catch_count: 1 },
  { type: 'landmark', landmark_id: post.id },
].entries()) {
  call('private_hunt_quest_save', editor, { p_hunt: hunt,
    p_quest: { ordinal: quest[0] + 1, points: 10, name: 'Fixture', ...point, ...quest[1] } })
}
const { quests: [editorArrive] } = call('private_hunt_edit_state', editor, { p_hunt: hunt })
const { join_code: code } = call('private_hunt_publish', editor, { p_hunt: hunt })
const preview = call('private_hunt_preview', jwt, { p_code: code })
assert.equal(preview.quest_objects.length, 5)
assert(!JSON.stringify(preview).includes('Oolong'))
const joined = call('private_hunt_join_code', jwt, { p_code: code })
const [arrive, question, price, caught, landmark] = joined.quest_objects
const payload = (quest, answer) => ({ payload: {
  quest_id: quest.quest_id, lat: quest.location_lat, lng: quest.location_lng, accuracy: 10, answer,
} })
expectError(rpc('private_hunt_quest_attempt', other, payload(arrive)), 'not_joined')
call('private_hunt_start', jwt, { p_hunt: hunt, ...loc })
assert.equal(call('private_hunt_quest_attempt', jwt, payload(arrive, { qr: editorArrive.qr_token })).done, true)
assert.equal(call('private_hunt_quest_attempt', jwt, payload(question, { text: 'no' })).ok, false)
assert.deepEqual(call('private_hunt_quest_attempt', jwt, payload(question, { text: ' Oolong ' })).correct_answer, { text: 'Tea' })
assert.equal(call('private_hunt_quest_attempt', jwt, payload(price, { usd: 8 })).hint, 'higher')
assert.equal(call('private_hunt_quest_attempt', jwt, payload(price, { usd: 15 })).hint, 'lower')
assert.deepEqual(call('private_hunt_quest_attempt', jwt, payload(price, { usd: 10 })).correct_answer,
  { usd: 10, local_amount: 320 })

call('private_hunt_quest_attempt', jwt, payload(caught))
const { spawns } = call('game_nearby', jwt, loc)
const spawn = spawns.find(x => x.quest_id === caught.quest_id)
assert(spawn)
const throwArgs = { p_spawn: spawn.spawn_id, p_ball: 'wax', p_ring: 1, p_hit: true, ...loc }
expectError(rpc('corrupted_capsule_throw', other, throwArgs), 'expired')
sql(`update public.player_game set wax_balls=100 where user_id='${member.id}'`)
assert.equal(call('corrupted_capsule_throw', jwt, throwArgs)[0].result, 'restored')

call('private_hunt_quest_attempt', jwt, payload(landmark))
const [fight] = call('landmark_start', jwt, { p_waypost: post.id, ...loc })
let hit
for (let i = 0; i < 30 && hit?.result !== 'won'; i++) {
  ;[hit] = call('landmark_hit', jwt, { p_attempt: fight.attempt_id, p_ball: 'wax', p_ring: 1, ...loc })
}
assert.equal(hit.result, 'won')
const reward = call('private_hunt_collect_reward', jwt, { p_hunt: hunt, ...loc })
assert(reward.reward_collected_at)
assert.equal(reward.points, 50)
assert(reward.quest_objects.every(q => q.done))

const city = 'xinyi-2026-11'
const keeper = JSON.parse(sql(`select jsonb_build_object('p_lat',keeper_lat,'p_lng',keeper_lng,'p_accuracy',10)
  from public.hunts where id='${city}'`))
assert.deepEqual(call('city_hunt_quests', jwt, { hunt_id: city }), [])
call('city_hunt_join', jwt, { p_hunt: city })
call('city_hunt_check_in', jwt, { p_hunt: city, ...keeper })
const cityQuests = call('city_hunt_quests', jwt, { hunt_id: city })
assert.equal(cityQuests.length, 5)
assert.equal(cityQuests.at(-1).type, 'landmark')
assert.equal(call('city_hunt_quest_attempt', jwt, payload(cityQuests[0])).done, true)
expectError(rpc('city_hunt_quest_attempt', jwt, payload(cityQuests.at(-1))), 'locked')

for (const quest of cityQuests.slice(1)) {
  const questLoc = { p_lat: quest.location_lat, p_lng: quest.location_lng, p_accuracy: 10 }
  const start = call('city_hunt_quest_attempt', jwt, payload(quest))
  if (quest.type === 'arrive') {
    assert.equal(start.done, true)
  } else if (quest.type === 'catch') {
    assert.equal(start.done, false)
    const releases = call('game_nearby', jwt, questLoc).spawns.filter(x => x.quest_id === quest.quest_id)
    assert.equal(releases.length, quest.catch_count)
    for (const release of releases) {
      const [result] = call('corrupted_capsule_throw', jwt,
        { p_spawn: release.spawn_id, p_ball: 'wax', p_ring: 1, p_hit: true, ...questLoc })
      assert.equal(result.result, 'restored')
    }
  } else {
    assert.equal(start.done, false)
    const [attempt] = call('landmark_start', jwt, { p_waypost: quest.landmark_id, ...questLoc })
    let result
    for (let i = 0; i < 30 && result?.result !== 'won'; i++) {
      const hits = call('landmark_hit', jwt, { p_attempt: attempt.attempt_id, p_ball: 'wax', p_ring: 1, ...questLoc })
      result = hits[0]
    }
    assert.equal(result.result, 'won')
  }
}
assert(call('city_hunt_quests', jwt, { hunt_id: city }).every(q => q.done))
assert.equal(call('city_hunt_finish', jwt, { p_hunt: city, ...keeper }).state, 'finished')

console.log('PASS: Supabase Auth JWTs, PostgREST RPCs, all five private quest types and full Xinyi City Hunt')
