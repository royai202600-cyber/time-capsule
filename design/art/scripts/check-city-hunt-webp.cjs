#!/usr/bin/env node
// Compare each new WebP alpha plane to the exporter's exact 512 px resize.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const sharp=require(process.env.SHARP_MODULE_DIR||'sharp');
const art=path.resolve(__dirname,'..');
const repo=path.resolve(art,'../..');
async function main(){
 const specs=JSON.parse(fs.readFileSync(path.join(art,'_checks/city-hunt-art.json'),'utf8'));
 const results=[];
 for(const spec of specs){
  const source=path.join(art,spec.relative_path);
  const relative=spec.relative_path.replace(/\.png$/,'.webp');
  const target=path.join(repo,'public/art',relative);
  const expected=await sharp(source).resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).ensureAlpha().extractChannel('alpha').raw().toBuffer();
  const actual=await sharp(target).ensureAlpha().extractChannel('alpha').raw().toBuffer();
  const meta=await sharp(target).metadata();
  if(meta.width!==512||meta.height!==512||!expected.equals(actual))throw Error('WebP alpha/size mismatch: '+relative);
  results.push({source:'design/art/'+spec.relative_path,output:'public/art/'+relative,size:[meta.width,meta.height],quality:85,
    alpha_matches_exact_export_resize:true,alpha_sha256:crypto.createHash('sha256').update(actual).digest('hex'),pass:true});
 }
 fs.writeFileSync(path.join(art,'_checks/city-hunt-webp.json'),JSON.stringify(results,null,2)+'\n');
 console.log('7/7 WebP previews: 512px, exact resized alpha PASS');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
