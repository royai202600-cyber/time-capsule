// Production release verification with a fresh disposable, confirmed, allow-listed user.
// Run with EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY and fixture JSON.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../mobile/package.json',import.meta.url));
const {createClient}=require('@supabase/supabase-js');
const fixture=JSON.parse(readFileSync(process.argv[2],'utf8'));
assert(fixture.email.endsWith('@example.invalid'));
const client=createClient(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const ok=({data,error})=>{assert.ifError(error);return data;};
const rpc=(name,args={})=>client.rpc(name,args);
const checks=[];const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS',name);};
const denied=(r,hint)=>{assert(r.error,'unexpected success');assert.equal(r.error.hint,hint);};
let uid;const send=v=>rpc('send_capsule',{p_recipient:uid,p_vessel:v,p_message:'Disposable release verification',p_hint:'Release QA',p_open_at:new Date(Date.now()+3600000).toISOString()});
let restored,landmark;
try{
 const auth=ok(await client.auth.signInWithPassword(fixture));uid=auth.user.id;
 const shores=ok(await client.from('sea_shores').select('*').eq('game_enabled',true));
 await check('starter send and free uncollected refusal',async()=>{ok(await send('dome'));denied(await send('memorial-candle'),'not_owned');});
 await check('brand acquisition and owned send; plain acquisition refused',async()=>{const n=ok(await rpc('acquire_vessel',{p_vessel:'maison'}));assert(n>0);ok(await send('maison'));denied(await rpc('acquire_vessel',{p_vessel:'vhs'}),'collect_only');});
 await check('passer-by bottle remains available',async()=>{const p=shores.find(s=>s.city_en==='Taipei');ok(await rpc('sea_throw',{p_message:'A hello for whoever passes by',p_hint:'Release QA',p_vessel:'bottle',p_drift_days:1,p_lat:p.lat,p_lng:p.lng,p_accuracy:10}));});
 await check('valid Waypost scenes and no development spawn IDs',async()=>{assert(shores.filter(s=>s.kind==='common').every(s=>['park','garden','waterfront','square','publicArt'].includes(s.scene)));const p=shores.find(s=>s.city_en==='Taipei');const n=ok(await rpc('corrupted_nearby',{p_lat:p.lat,p_lng:p.lng,p_accuracy:10}));assert(n.wayposts.every(s=>s.kind==='landmark'?s.scene===null:['park','garden','waterfront','square','publicArt'].includes(s.scene)));assert(n.spawns.every(s=>!s.spawn_id.startsWith('dev-')));});
 await check('server restores Corrupted Capsule, grants ownership, permits sending',async()=>{
  const seen=new Set();let throws=0;
  for(const post of shores.filter(s=>s.kind==='common')){
   const n=ok(await rpc('corrupted_nearby',{p_lat:post.lat,p_lng:post.lng,p_accuracy:10}));
   for(const s of n.spawns.filter(s=>!s.already_caught&&!seen.has(s.spawn_id)).sort((a,b)=>(a.rarity==='common'?-1:1)-(b.rarity==='common'?-1:1))){
    seen.add(s.spawn_id);
    for(let i=0;i<s.attempts_left&&throws<16;i++){
     const st=ok(await rpc('game_state'))[0];const ball=st.gold_balls>0?'gold':'wax';
     const out=ok(await rpc('corrupted_throw',{p_spawn:s.spawn_id,p_lat:s.lat,p_lng:s.lng,p_accuracy:10,p_ball:ball,p_ring:1,p_hit:true}))[0];throws++;
     if(out.result==='restored'){restored={...s,...out};break;}
    }
    if(restored||throws>=16)break;
   }
   if(restored||throws>=16)break;
  }
  assert(restored,'no restoration within bounded attempts');const collection=ok(await rpc('my_collection'));assert(collection.some(v=>v.vessel===restored.vessel&&v.copies>=1&&v.stars>=1));ok(await send(restored.vessel));
 });
 await check('full real solo Landmark fight, earned vessel and Album stars',async()=>{
  const p=shores.find(s=>s.place==='taipei101');landmark=p;
  const a=ok(await rpc('landmark_start',{p_waypost:p.id,p_lat:p.lat,p_lng:p.lng,p_accuracy:10}))[0];let out;
  for(let i=0;i<12;i++){out=ok(await rpc('landmark_hit',{p_attempt:a.attempt_id,p_lat:p.lat,p_lng:p.lng,p_accuracy:10,p_ball:'wax',p_ring:1}))[0];if(out.result==='won')break;}
  assert.equal(out.result,'won');assert.equal(out.vessel,'bamboo-tower');assert(out.stars>=1);const collection=ok(await rpc('my_collection'));assert(collection.some(v=>v.vessel==='bamboo-tower'&&v.stars===out.stars));ok(await send(out.vessel));
 });
 await check('sealed contents still denied',async()=>{assert((await client.from('capsule_contents').select('*')).error);});
 writeFileSync(process.argv[3]??'/tmp/tc-game-release-api.json',JSON.stringify({checks,restored,landmark},null,2));
}finally{await client.auth.signOut();}
