#!/usr/bin/env node
// Verify the four new WebPs against the exporter's exact source resize.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const sharp=require(process.env.SHARP_MODULE_DIR||'sharp');
const art=path.resolve(__dirname,'..');
const repo=path.resolve(art,'../..');
async function main(){
 const results=[];
 for(const suffix of ['', '-box','-lid','-shadow']){
  const name=`vessel-red-bird${suffix}`;
  const source=path.join(art,'vessels',name+'.png');
  const target=path.join(repo,'public/art/vessels',name+'.webp');
  const expected=await sharp(source).resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).ensureAlpha().extractChannel('alpha').raw().toBuffer();
  const actual=await sharp(target).ensureAlpha().extractChannel('alpha').raw().toBuffer();
  const meta=await sharp(target).metadata();
  if(meta.width!==512||meta.height!==512||!expected.equals(actual))throw Error(name+': WebP size/alpha mismatch');
  results.push({file:'public/art/vessels/'+name+'.webp',size:[meta.width,meta.height],quality:85,
   exact_resized_alpha:true,alpha_sha256:crypto.createHash('sha256').update(actual).digest('hex'),pass:true});
 }
 fs.writeFileSync(path.join(art,'_checks/red-bird-webp.json'),JSON.stringify(results,null,2)+'\n');
 console.log('4/4 Red Bird WebPs: 512px / quality85 / exact resized alpha PASS');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
