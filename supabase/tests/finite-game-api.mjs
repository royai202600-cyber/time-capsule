// Real-JWT finite-wave check. Use only a disposable confirmed, speed-allow-listed account.
import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const require=createRequire(new URL('../../mobile/package.json',import.meta.url));const {createClient}=require('@supabase/supabase-js');
const fixture=JSON.parse(readFileSync(process.argv[2],'utf8'));assert(fixture.email.endsWith('@example.invalid'));
const client=createClient(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const ok=({data,error})=>{assert.ifError(error);return data;};
const at={p_lat:25.037546,p_lng:121.562754,p_accuracy:10};const nearby=async()=>ok(await client.rpc('corrupted_nearby',at)).spawns;
try{
 ok(await client.auth.signInWithPassword(fixture));const first=await nearby();assert(first.length>0&&first.length<=6);
 const ids=new Set(first.map(s=>s.spawn_id));let restored=false;
 for(const s of first.sort((a,b)=>(a.rarity==='common'?0:1)-(b.rarity==='common'?0:1))){
  for(let i=0;i<s.attempts_left;i++){
   const out=ok(await client.rpc('corrupted_throw',{p_spawn:s.spawn_id,p_lat:s.lat,p_lng:s.lng,p_accuracy:10,p_ball:'wax',p_ring:1,p_hit:true}))[0];
   if(out.result==='restored'){restored=true;break;}
  }
  if(restored)break;
 }
 assert(restored,'no restoration in bounded wave attempts');const after=await nearby();
 assert(after.length<first.length);assert(after.every(s=>ids.has(s.spawn_id)),'catch refilled a slot');assert.deepEqual(await nearby(),after);
 console.log(`PASS real JWT: ${first.length} -> ${after.length}, no replacement IDs and stable refresh after restoration`);
}finally{await client.auth.signOut();}
