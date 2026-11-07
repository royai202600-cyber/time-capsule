// Real public-key/JWT API assertions. Supply two disposable confirmed users with
// profiles and a sender -> recipient friendship; provision/remove them as admin.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../../mobile/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const env = Object.fromEntries(readFileSync(new URL('../../mobile/.env.local', import.meta.url), 'utf8').split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0,i),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')]; }));
assert.equal(new URL(env.EXPO_PUBLIC_SUPABASE_URL).hostname,'uzimuygyxwraybsipeij.supabase.co');
const path = process.argv[2], fixture = JSON.parse(readFileSync(path,'utf8'));
assert.equal(fixture.users.length,2);
assert(fixture.users.every(u => /^vessels-[a-f0-9]+@example\.invalid$/.test(u.email)));
const clients = fixture.users.map(() => createClient(env.EXPO_PUBLIC_SUPABASE_URL,env.EXPO_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}}));
const [sender,recipient] = clients;
const ok = r => { assert.ifError(r.error); return r.data; };
const denied = (r,hint) => { assert(r.error,'unexpected success'); if(hint) assert.equal(r.error.hint,hint); };
const checks=[];
const check = async(name,fn) => { await fn(); checks.push(name); console.log('PASS',name); };
const input = (extra={}) => ({p_recipient:fixture.users[1].id,p_vessel:'photo-strip',p_message:'Vessel API regression letter',p_hint:'Vessel QA',p_open_at:new Date(Date.now()+1500).toISOString(),...extra});
for(let i=0;i<2;i++) ok(await clients[i].auth.signInWithPassword(fixture.users[i]));
const catalogue = ok(await sender.from('vessels').select('*').order('sort'));
const landmarks = catalogue.filter(v=>v.earned_place);
await check('47 catalogue rows: 37 regular and ten earned landmarks',async()=>{assert.equal(catalogue.length,47);assert.equal(landmarks.length,10);assert.equal(catalogue.filter(v=>!v.earned_place).length,37);});
await check('all ten landmarks reject acquisition and zero-price unowned sending',async()=>{
 for(const v of landmarks){denied(await sender.rpc('acquire_vessel',{p_vessel:v.id}),'earned_only');denied(await sender.rpc('send_capsule',input({p_vessel:v.id})),'not_owned');}
});
const places=ok(await sender.from('places').select('*'));
const ids=[];
for(const v of landmarks){const id=ok(await sender.rpc('send_capsule',input({p_place:v.earned_place})));ids.push({id,vessel:v.id,place:v.earned_place});}
fixture.landmarkCapsules=ids;writeFileSync(path,JSON.stringify(fixture),{mode:0o600});
// API calls above generally exceed 1.5 seconds; wait briefly only if still locked.
await new Promise(r=>setTimeout(r,1700));
await check('missing, inaccurate, far and wrong-recipient opens give no reward',async()=>{
 const {id}=ids[0], p=places.find(p=>p.id===ids[0].place);
 denied(await sender.rpc('open_capsule',{p_id:id,p_lat:p.lat,p_lng:p.lng,p_accuracy:10}));
 denied(await recipient.rpc('open_capsule',{p_id:id}),'no_location');
 denied(await recipient.rpc('open_capsule',{p_id:id,p_lat:p.lat,p_lng:p.lng,p_accuracy:201}),'inaccurate');
 denied(await recipient.rpc('open_capsule',{p_id:id,p_lat:0,p_lng:0,p_accuracy:10}),'far');
 assert.deepEqual(ok(await recipient.from('owned_vessels').select('*')),[]);
});
await check('all ten server-checked openings award only the recipient, once',async()=>{
 for(const item of ids){const p=places.find(p=>p.id===item.place);const opened=ok(await recipient.rpc('open_capsule',{p_id:item.id,p_lat:p.lat,p_lng:p.lng,p_accuracy:10}))[0];assert.equal(opened.message,'Vessel API regression letter');assert.equal(ok(await recipient.rpc('open_capsule',{p_id:item.id}))[0].opened_at,opened.opened_at);}
 const owned=ok(await recipient.from('owned_vessels').select('*'));assert.equal(owned.length,10);assert.deepEqual(owned.map(v=>v.vessel).sort(),landmarks.map(v=>v.id).sort());
 assert.deepEqual(ok(await sender.from('owned_vessels').select('*')),[]);
});
await check('earned owners may send; ordinary paid acquisition and free sending still work',async()=>{
 ok(await recipient.rpc('send_capsule',input({p_recipient:fixture.users[1].id,p_vessel:'clock-tower'})));
 ok(await sender.rpc('acquire_vessel',{p_vessel:'vinyl'}));
 ok(await sender.rpc('send_capsule',input({p_vessel:'vinyl'})));
 ok(await sender.rpc('send_capsule',input()));
});
await check('ownership writes and sealed contents remain forbidden',async()=>{
 denied(await sender.from('owned_vessels').insert({user_id:fixture.users[0].id,vessel:'clock-tower'}));
 denied(await sender.from('capsule_contents').select('*'));
});
writeFileSync(process.argv[3]??'/tmp/tc-landmark-api-results.json',JSON.stringify({checks,passed:checks.length},null,2));
for(const client of clients) await client.auth.signOut();
