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
 const {session:owner,id:ownerId}=await login('Guide organizer');
 const {session:player,id:playerId}=await login('Guide player');
 const {session:outsider}=await login('Guide outsider');
 sql(`update public.profiles set can_create_hunts=true where id='${ownerId}'`);
 const actionRadius=Number(sql('select action_radius_m from private.game_config where singleton').trim());
 assert(actionRadius>50,'fixture pickup radius must exercise the former 50 m boundary');
 const insideGuideLat=25+(50+actionRadius)/2/111195;
 const outsideGuideLat=25+(actionRadius+10)/111195;
 for(const mode of ['near','fixed']) {
  const draft={name:'Guide '+mode,description:'',cover:null,route_mode:'any',leaderboard_visible:true,starts_at:new Date(Date.now()-60000).toISOString(),ends_at:new Date(Date.now()+3600000).toISOString(),time_limit_min:15,guide_mode:mode,guide_lat:mode==='fixed'?25:null,guide_lng:mode==='fixed'?121:null};
  const {id}=ok(await owner.rpc('private_hunt_create',{p_draft:draft}));
  ok(await owner.rpc('private_hunt_update',{p_hunt:id,p_draft:draft}));
  ok(await owner.rpc('private_hunt_quest_save',{p_hunt:id,p_quest:{name:'Arrive',quest_type:'arrive',location_lat:25,location_lng:121,ordinal:1,points:10}}));
  const edit=ok(await owner.rpc('private_hunt_edit_state',{p_hunt:id}));assert.equal(edit.draft.guide_mode,mode);
  const {join_code}=ok(await owner.rpc('private_hunt_publish',{p_hunt:id}));
  const joined=ok(await player.rpc('hunt_join_code',{p_code:join_code}));assert.equal(joined.run_started_at,null);assert.equal(joined.run_ends_at,null);
  const args={p_hunt:id,p_lat:mode==='fixed'?insideGuideLat:25,p_lng:121,p_accuracy:10};
  assert.equal((await outsider.rpc('private_hunt_start',args)).error.message,'not_joined');
  const quest=edit.quests[0];const complete={p_quest:quest.id,p_lat:25,p_lng:121,p_accuracy:10,p_answer:null,p_qr:null};
  assert.equal((await player.rpc('private_hunt_quest_complete',complete)).error.message,'not_started');
  assert.equal((await player.rpc('private_hunt_start',{...args,p_lat:26})).error.message,'too_far');
  assert.equal((await player.rpc('private_hunt_start',{...args,p_accuracy:201})).error.message,'too_far');
  if(mode==='fixed')assert.equal((await player.rpc('private_hunt_start',{...args,p_lat:outsideGuideLat})).error.message,'too_far');
  const started=ok(await player.rpc('private_hunt_start',args));assert(started.started_at);assert.equal(Date.parse(started.run_ends_at)-Date.parse(started.started_at),900000);
  assert.equal(ok(await player.rpc('private_hunt_start',args)).started_at,started.started_at);
  assert.equal((await player.rpc('private_hunt_collect_reward',args)).error.message,'not_finished');
  const finished=ok(await player.rpc('hunt_mission_complete',{p_waypoint:quest.id,p_lat:25,p_lng:121,p_accuracy:10,p_answer:null,p_qr:null}));assert(finished.hunt.finished_at);
  assert(!ok(await player.rpc('my_passport')).some(s=>s.place===id));
  assert.equal((await player.rpc('private_hunt_collect_reward',{...args,p_lat:26})).error.message,'too_far');
  if(mode==='fixed')assert.equal((await player.rpc('private_hunt_collect_reward',{...args,p_lat:outsideGuideLat})).error.message,'too_far');
  if(mode==='near')sql(`update public.hunts set starts_at=now()-interval '2 hours', ends_at=now()-interval '1 second' where id='${id}'`);
  const reward=ok(await player.rpc('private_hunt_collect_reward',mode==='near'?{p_hunt:id}:args));assert(reward.reward_collected_at);
  assert.equal(ok(await player.rpc('private_hunt_collect_reward',{p_hunt:id})).reward_collected_at,reward.reward_collected_at);
  assert(ok(await player.rpc('my_passport')).some(s=>s.place===id));
  assert.equal((await owner.rpc('private_hunt_update',{p_hunt:id,p_draft:{...draft,guide_mode:mode==='near'?'fixed':'near',guide_lat:mode==='near'?25:null,guide_lng:mode==='near'?121:null}})).error!==null,true);
 }
 // Closing releases the location check. Hiding blocks claims until the hunt is restored.
 for(const unavailable of ['closed','hidden']) {
  const draft={name:'Guide '+unavailable,description:'',route_mode:'any',leaderboard_visible:true,starts_at:new Date(Date.now()-60000).toISOString(),ends_at:new Date(Date.now()+3600000).toISOString(),guide_mode:'fixed',guide_lat:25,guide_lng:121};
  const {id}=ok(await owner.rpc('private_hunt_create',{p_draft:draft}));
  ok(await owner.rpc('private_hunt_quest_save',{p_hunt:id,p_quest:{name:'Arrive',quest_type:'arrive',location_lat:25,location_lng:121,ordinal:1,points:10}}));
  const {join_code}=ok(await owner.rpc('private_hunt_publish',{p_hunt:id}));
  const joined=ok(await player.rpc('private_hunt_join_code',{p_code:join_code}));
  ok(await outsider.rpc('private_hunt_join_code',{p_code:join_code}));
  const args={p_hunt:id,p_lat:25,p_lng:121,p_accuracy:10};
  ok(await player.rpc('private_hunt_start',args));
  const finished=ok(await player.rpc('private_hunt_quest_complete',{p_quest:joined.quests[0].id,p_lat:25,p_lng:121,p_accuracy:10,p_answer:null,p_qr:null}));
  assert(finished.hunt.finished_at);
  assert.equal((await player.rpc('private_hunt_collect_reward',{p_hunt:id})).error.message,'too_far');
  if(unavailable==='closed')ok(await owner.rpc('private_hunt_close',{p_hunt:id}));
  else sql(`update public.hunts set hidden_at=now() where id='${id}'`);
  assert.equal(sql(`select ends_at>now() from public.hunts where id='${id}'`).trim(),'t');
  if(unavailable==='hidden'){
   assert(!ok(await player.rpc('private_hunt_joined')).some(h=>h.id===id));
   for(const member of [player,outsider])assert.equal((await member.rpc('private_hunt_collect_reward',args)).error.message,'not_joined');
   assert(!ok(await player.rpc('my_passport')).some(s=>s.place===id));
   sql(`update public.hunts set hidden_at=null where id='${id}'`);
   assert.equal((await player.rpc('private_hunt_collect_reward',{p_hunt:id})).error.message,'too_far');
  }
  assert.equal((await outsider.rpc('private_hunt_collect_reward',{p_hunt:id})).error.message,'not_finished');
  assert(!ok(await outsider.rpc('my_passport')).some(s=>s.place===id));
  const reward=ok(await player.rpc('private_hunt_collect_reward',unavailable==='hidden'?args:{p_hunt:id}));
  assert(reward.reward_collected_at);
  assert.equal(ok(await player.rpc('private_hunt_collect_reward',{p_hunt:id})).reward_collected_at,reward.reward_collected_at);
  assert(ok(await player.rpc('my_passport')).some(s=>s.place===id));
 }
 // A fixed guide supplies the area for a hunt containing only location-free catches.
 const {id}=ok(await owner.rpc('private_hunt_create',{p_draft:{name:'Catch guide',description:'',route_mode:'any',leaderboard_visible:true,starts_at:new Date(Date.now()-60000).toISOString(),ends_at:new Date(Date.now()+3600000).toISOString(),time_limit_min:15,guide_mode:'fixed',guide_lat:25.037546,guide_lng:121.562754}}));
 const q={name:'Restore two',quest_type:'restore',location_lat:null,location_lng:null,ordinal:1,points:37,catch_count:2};
 assert((await owner.rpc('private_hunt_quest_save',{p_hunt:id,p_quest:{...q,catch_count:21}})).error);
 assert((await owner.rpc('private_hunt_quest_save',{p_hunt:id,p_quest:{...q,location_lat:25,location_lng:121}})).error);
 ok(await owner.rpc('private_hunt_quest_save',{p_hunt:id,p_quest:q}));
 const {join_code}=ok(await owner.rpc('private_hunt_publish',{p_hunt:id}));
 ok(await player.rpc('private_hunt_join_code',{p_code:join_code}));
 const pos={p_lat:25.037546,p_lng:121.562754,p_accuracy:10};
 ok(await player.rpc('private_hunt_start',{p_hunt:id,...pos}));
 const nearby=ok(await player.rpc('game_nearby',pos));
 sql(`insert into private.game_speed_allowlist(user_id) values('${playerId}') on conflict do nothing; update public.player_game set gold_balls=100 where user_id='${playerId}'`);
 let restores=0;
 for(const spawn of nearby.spawns){
  for(let attempt=0;attempt<3;attempt++){
   const args={p_spawn:spawn.spawn_id,p_lat:spawn.lat,p_lng:spawn.lng,p_accuracy:10,p_ball:'gold',p_ring:1,p_hit:true};
   const result=ok(await player.rpc('corrupted_throw',args))[0];
   if(result.result==='restored'){
    restores++;assert(result.xp_gained>0);
    assert.equal((await player.rpc('corrupted_throw',args)).error.message,'already_caught');break;
   }
  }
  if(restores>=2)break;
 }
 assert(restores>=2,'two real catches');
 const state=ok(await player.rpc('private_hunt_joined')).find(h=>h.id===id);
 assert.equal(state.quests[0].caught_count,2);assert.equal(state.points,37);assert(state.finished_at);assert.equal(state.reward_collected_at,null);
 assert(!ok(await player.rpc('my_passport')).some(s=>s.place===id));
 ok(await player.rpc('private_hunt_collect_reward',{p_hunt:id,...pos}));
 await Promise.all([owner,player,outsider].map(c=>c.auth.signOut()));
 console.log('PASS real JWT: both guide modes, wrapper joins/quests/catches, start gate, configured guide radius, accuracy/range, timer/idempotency, deferred stamp, expiry/closed claims, hidden refusal and restoration, unfinished refusal and catch points');
} finally {
  const results = await Promise.all(fixtures.reverse().map(id => admin.auth.admin.deleteUser(id)));
  results.forEach(ok);
  assert.equal(sql(`select count(*) from auth.users where id::text in ('${fixtures.join("','")}')`).trim(), '0');
}
