// Run against the disposable HL-C4 database and Auth/REST containers.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const dbContainer = 'supabase_db_time-capsule'
const authHost = 'http://tc-c4-auth:9999'
const restHost = 'http://tc-c4-rest:3000'
const database = 'tc_todays_hunt_verify'

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
  const email = `todays-hunt-jwt-${randomUUID()}@example.invalid`
  const password = randomUUID()
  const signup = ok(request(authHost + '/signup', { email, password }))
  const session = ok(request(authHost + '/token?grant_type=password', { email, password }))
  assert.equal(signup.user.id, session.user.id)
  assert.match(session.user.id, /^[a-f0-9-]{36}$/)
  return { id: session.user.id, jwt: session.access_token }
}

const users = []
try {
  for (let i = 0; i < 4; i++) users.push(player())
  const [admin, me, friend, stranger] = users
  sql(`
    insert into public.profiles(id,name)
    select id,'HL-C4 JWT fixture' from auth.users where id in (${users.map(u => "'"+u.id+"'").join(',')})
    on conflict(id) do nothing;
    insert into private.admin_members(user_id,role) values ('${admin.id}','admin');
    insert into public.friendships(user_id,friend_id) values ('${me.id}','${friend.id}'),('${friend.id}','${me.id}');
  `)
  const center = JSON.parse(sql("select row_to_json(c) from private.todays_hunt_center('taipei') c"))
  const common = { city: 'taipei', place_zh: '測試', place_en: 'Fixture', prompt_zh: '問題', prompt_en: 'Prompt',
    source_url: 'https://example.invalid', checked_on: '2026-11-18',
    location_lat: center.lat, location_lng: center.lng }
  for (const item of [
    { type: 'question', kind: 'choice', answer: 0, choices: [{ zh: '甲', en: 'A' }, { zh: '乙', en: 'B' }] },
    { type: 'price', currency: 'NT$', rate: 10, local_amount: 100 },
  ]) {
    const { id } = call('admin_question_pool_save', admin.jwt, { payload: { ...common, ...item } })
    call('admin_question_pool_set_status', admin.jwt, { id, status: 'published' })
  }

  const city = { p_city: 'taipei' }
  const initial = call('todays_hunt', me.jwt, city)
  assert.deepEqual(initial.quests.map(q => q.type), ['question','price','catch'])
  assert(initial.quests.every(q => !('correct_answer' in q)))
  assert.deepEqual(call('todays_hunt', friend.jwt, city), initial)
  assert(rpc('todays_hunt', null, city).status >= 400)
  assert(request(restHost + '/todays_hunt_plays?select=*', undefined, me.jwt).status >= 400)

  const calendar = { ...city, p_from: initial.date, p_days: 1 }
  expectError(rpc('admin_todays_hunt_calendar', me.jwt, calendar), 'forbidden')
  assert.deepEqual(call('admin_todays_hunt_calendar', admin.jwt, calendar)[0].quests[0].correct_answer, { choice: 0 })

  const attempt = (ordinal, answer) => ({ ...city, p_ordinal: ordinal, p_answer: answer })
  assert.deepEqual(call('todays_hunt_attempt', me.jwt, attempt(1, { choice: 1 })).correct_answer, { choice: 0 })
  const miss = call('todays_hunt_attempt', me.jwt, attempt(2, { usd: 2 }))
  assert.equal(miss.hint, 'higher')
  assert(!('correct_answer' in miss))
  assert(!('correct_answer' in call('todays_hunt', me.jwt, city).quests[1]))
  assert.equal(call('todays_hunt_attempt', me.jwt, attempt(2, { usd: 10 })).points, 10)

  sql(`select private.ensure_player('${me.id}')`)
  const balance = () => Number(sql(`select wax_balls from public.player_game where user_id='${me.id}'`))
  const before = balance()
  assert.equal(call('todays_hunt_attempt', me.jwt, attempt(3, { caught: 6 })).points, 10)
  expectError(rpc('todays_hunt_attempt', me.jwt, attempt(3, { caught: 3 })), 'already_done')
  assert.equal(balance(), before + 3)
  assert.equal(call('todays_hunt', me.jwt, city).score, 22)

  for (const player of [friend, stranger]) call('todays_hunt_attempt', player.jwt, attempt(1, { choice: 0 }))
  assert.deepEqual(call('todays_hunt_friends', me.jwt, city).map(row => row.user.id), [me.id, friend.id])
  assert.equal(call('city_puzzle_today', me.jwt).puzzles.length, 4)
  console.log('HL-C4 real JWT checks passed')
} finally {
  if (users.length) {
    const ids = users.map(u => "'"+u.id+"'").join(',')
    sql(`delete from private.admin_members where user_id in (${ids}); delete from auth.users where id in (${ids})`)
    assert.equal(sql(`select count(*) from auth.users where id in (${ids})`), '0')
  }
}
