// Real-JWT checks using a fresh disposable allow-listed user and approved public test positions.
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../mobile/package.json',import.meta.url));
const {createClient}=require('@supabase/supabase-js');
const fixture=JSON.parse(readFileSync(process.argv[2],'utf8'));
const positions=JSON.parse(readFileSync(process.argv[3],'utf8'));
assert(fixture.email.endsWith('@example.invalid'));
const client=createClient(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const ok=({data,error})=>{assert.ifError(error);return data;};
const pools={Taipei:['bubble-tea','bento','hot-air-balloon'],'Hong Kong':['dim-sum-steamer','postbox','phone-booth'],Singapore:['lucky-stars','mixtape','instant-camera'],Macau:['candy-box','musicbox','pocket-watch']};
const rad=n=>n*Math.PI/180;
const distance=(a,b)=>6371000*2*Math.asin(Math.sqrt(Math.sin(rad(a.lat-b.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(a.lng-b.lng)/2)**2));
const nearby=async p=>ok(await client.rpc('corrupted_nearby',{p_lat:p.lat,p_lng:p.lng,p_accuracy:10}));
try{
 ok(await client.auth.signInWithPassword(fixture));
 for(const p of positions){
  const first=await nearby(p),again=await nearby(p);
  assert.equal(first.spawns.length,6,`${p.city_en}: target not filled at approved test location`);
  assert.deepEqual(first.spawns,again.spawns,'refresh changed the current wave');
  for(const s of first.spawns){
   assert(pools[p.city_en].includes(s.vessel));assert(distance(p,s)<=100.01);
   assert(!s.spawn_id.startsWith('dev-'));
   for(const other of first.spawns)if(s.spawn_id!==other.spawn_id)assert(distance(s,other)>=27.99);
  }
  console.log(`PASS ${p.city_en}: six reachable, separated, stable, approved regional vessels`);
 }
 assert.equal((await nearby({lat:0,lng:0})).spawns.length,0,'unsafe filler');
 const civic=await nearby({lat:25.037546,lng:121.562754});
 assert(civic.spawns.length<=6);
 console.log(`PASS Taipei Civic Square: ${civic.spawns.length} available, no background test batch needed`);
}finally{await client.auth.signOut();}
