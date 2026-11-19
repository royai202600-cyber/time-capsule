// Run against the disposable local database with HL-C5 applied.
// Its Auth and REST containers are attached to the existing Supabase Docker network.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const dbContainer = 'supabase_db_time-capsule'
const authHost = 'http://tc-route-auth:9999'
const restHost = 'http://tc-route-rest:3000'
const database = 'tc_route_verify'

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
  const email = `route-jwt-${randomUUID()}@example.invalid`
  const password = randomUUID()
  const signup = ok(request(authHost + '/signup', { email, password }))
  const session = ok(request(authHost + '/token?grant_type=password', { email, password }))
  assert.equal(signup.user.id, session.user.id)
  assert.match(session.user.id, /^[a-f0-9-]{36}$/)
  return { id: session.user.id, jwt: session.access_token }
}

const users = []
try {
  const sender = player()
  users.push(sender)
  const recipient = player()
  users.push(recipient)
  sql(`insert into public.profiles(id,name) values
      ('${sender.id}','HL-C5 sender'),('${recipient.id}','HL-C5 recipient') on conflict do nothing;
    insert into public.friendships(user_id,friend_id) values ('${sender.id}','${recipient.id}');`)

  const point = { location_lat: 25.033667, location_lng: 121.564810, name: 'Taipei fixture' }
  const send = { p_vessel: 'dome', p_hint: '', p_message: 'Sealed letter',
    p_open_at: new Date(Date.now() + 60_000).toISOString() }
  const friend = call('send_capsule', sender.jwt, { ...send, p_recipient: recipient.id,
    p_route: [{ ...point, type: 'arrive' }] })
  const memory = call('send_capsule', sender.jwt, { ...send, p_recipient: sender.id,
    p_route: [{ ...point, type: 'question', own_question: 'What did we drink?', own_answer: 'Tea' }] })
  const oldPlace = call('send_capsule', sender.jwt, { ...send, p_recipient: recipient.id, p_place: 'taipei101' })
  const anywhere = call('send_capsule', sender.jwt, { ...send, p_recipient: recipient.id })
  const legacyPoint = call('send_capsule', sender.jwt, { ...send, p_recipient: recipient.id,
    p_place_lat: point.location_lat, p_place_lng: point.location_lng, p_place_name: point.name })

  const counts = (id, jwt) => ok(request(`${restHost}/capsules?id=eq.${id}&select=route_total,route_done`, undefined, jwt))
  const progress = (id, jwt) => call('route_progress', jwt, { p_capsule: id })
  const open = (id, jwt, extra) => rpc('open_capsule', jwt, { p_id: id, ...extra })
  const attempt = (id, jwt, quest, answer) => call('route_attempt', jwt, { p_capsule: id, p_payload: {
    quest_id: quest.quest_id, lat: quest.location_lat, lng: quest.location_lng, accuracy: 10, answer,
  } })

  assert.deepEqual(counts(friend, sender.jwt), [{ route_total: 1, route_done: 0 }])
  expectError(rpc('route_progress', sender.jwt, { p_capsule: friend }), 'capsule not found')
  expectError(open(friend, sender.jwt), 'capsule not found')
  const [arrive] = progress(friend, recipient.jwt)
  assert.equal(arrive.points, 0)
  const [question] = progress(memory, sender.jwt)
  assert(!('correct_answer' in question))
  const incorrect = attempt(memory, sender.jwt, question, { text: 'Coffee' })
  assert.equal(incorrect.done, false)
  assert(!('correct_answer' in incorrect))
  assert.deepEqual(attempt(memory, sender.jwt, question, { text: '  tea ' }).correct_answer, { text: 'Tea' })
  expectError(open(memory, sender.jwt), 'not yet')

  sql(`update public.capsules set open_at=now()-interval '1 second'
    where id in ('${friend}','${memory}','${oldPlace}','${anywhere}','${legacyPoint}');`)
  expectError(open(friend, recipient.jwt), 'route incomplete')
  assert.deepEqual(attempt(friend, recipient.jwt, arrive), { ok: true, done: true, points: 0 })
  assert.deepEqual(counts(friend, sender.jwt), [{ route_total: 1, route_done: 1 }])
  assert.deepEqual(counts(friend, recipient.jwt), [{ route_total: 1, route_done: 1 }])
  assert.equal(ok(open(friend, recipient.jwt))[0].message, send.p_message)
  assert.equal(ok(open(memory, sender.jwt))[0].message, send.p_message)
  assert.equal(ok(open(anywhere, recipient.jwt))[0].message, send.p_message)

  const location = { p_lat: point.location_lat, p_lng: point.location_lng, p_accuracy: 10 }
  for (const legacy of [oldPlace, legacyPoint]) {
    expectError(open(legacy, recipient.jwt), 'location needed')
    assert.equal(ok(open(legacy, recipient.jwt, location))[0].message, send.p_message)
  }
  console.log('PASS: GoTrue JWTs and PostgREST for friend routes, Memory Routes, Anywhere, place id and point sends')
} finally {
  for (const user of users) {
    ok(request(authHost + '/logout', {}, user.jwt))
    sql(`delete from auth.users where id='${user.id}'`)
  }
}
