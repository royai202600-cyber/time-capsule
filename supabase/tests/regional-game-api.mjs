// Read-only live regional checks with a disposable confirmed, speed-allow-listed user.
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../mobile/package.json',import.meta.url));
const {createClient}=require('@supabase/supabase-js');
const fixture=JSON.parse(readFileSync(process.argv[2],'utf8'));
assert(fixture.email.endsWith('@example.invalid'));
const client=createClient(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const ok=({data,error})=>{assert.ifError(error);return data;};
const pools={Taipei:['bubble-tea','bento','hot-air-balloon'],'Hong Kong':['dim-sum-steamer','postbox','phone-booth'],Singapore:['lucky-stars','mixtape','instant-camera'],Macau:['candy-box','musicbox','pocket-watch']};
try{
 ok(await client.auth.signInWithPassword(fixture));
 const posts=ok(await client.from('sea_shores').select('city_en,lat,lng').eq('game_enabled',true));
 for(const [city,pool] of Object.entries(pools)){
  const seen=new Set();
  for(const post of posts.filter(p=>p.city_en===city)){
   const result=ok(await client.rpc('corrupted_nearby',{p_lat:post.lat,p_lng:post.lng,p_accuracy:10}));
   for(const s of result.spawns){
    assert(pool.includes(s.vessel),`${city}: unexpected vessel ${s.vessel}`);
    assert(!s.spawn_id.startsWith('dev-'));
    const expiry=new Date(s.expires_at).getTime();assert(expiry>Date.now()-5000&&expiry<=Math.ceil(Date.now()/600000)*600000);
    seen.add(s.spawn_id);
   }
  }
  assert(seen.size>0,`${city}: no active capsules in this wave`);
  console.log(`PASS ${city}: ${seen.size} active server releases, approved pool and ten-minute expiry`);
 }
}finally{await client.auth.signOut();}
