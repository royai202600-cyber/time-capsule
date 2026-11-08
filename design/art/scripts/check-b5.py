#!/usr/bin/env python3
"""Validate B5 export, opening and provenance contracts against current main."""
import hashlib,json,runpy,subprocess
from pathlib import Path
from PIL import Image,ImageChops
R=Path(__file__).resolve().parents[1];REPO=R.parent.parent;C=R/'_checks';V=R/'vessels'
IDS=['hot-air-balloon','bubble-tea','dim-sum-steamer','bento','paper-cranes','heart-locket','suitcase','postbox','camp-lantern','treasure-chest']
F=runpy.run_path(str(R/'scripts/finish-batch1.py'));EXP=runpy.run_path(str(R/'scripts/check-batch1.py'))['expanded']
def bbox(im):return im.getchannel('A').point(lambda a:255 if a>25 else 0).getbbox()
def same(a,b):return all(ImageChops.difference(a,b).getchannel(c).getbbox() is None for c in 'RGBA')
def blob(path):
 data=path.read_bytes();return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def main():
 entries=json.loads((R/'manifest.json').read_text());specs={e['vessel']['id']:e['vessel'] for e in entries if e.get('vessel',{}).get('id')in IDS};assert set(specs)==set(IDS)
 reports={};exports=0
 for id,s in specs.items():
  assert set(s)<=set('id opening idleMs idle layers mouth baseY sparkle glint openGlow readyPulse letterDrop'.split())
  assert 3400<=s['idleMs']<=4600
  parts={l['name']:Image.open(V/l['file']).convert('RGBA') for l in s['layers']};im=Image.open(V/f'vessel-{id}.png').convert('RGBA');stack=Image.new('RGBA',im.size)
  for l in s['layers']:
   first=l.get('open',[{'at':0}])[0]
   assert first['at']==0 and all(v==(1 if k in ('scale','scaleX','scaleY','opacity') else 0)for k,v in first.items()if k!='at')
   stack=Image.alpha_composite(stack,parts[l['name']])
  assert same(im,stack),(id,'closed')
  # Pillow's affine identity unpremultiplies RGBA and can round RGB by one.
  # Raw rest compositing above is exact; alpha must also remain exact here.
  sampled=EXP(parts,s,0).crop((256,256,1280,1280));diff=ImageChops.difference(im,sampled)
  assert diff.getchannel('A').getbbox() is None and all(diff.getchannel(c).getextrema()[1]<=1 for c in 'RGB')
  b=bbox(im);assert b[2]-b[0]<=760 and b[1]>=100 and 880<=b[3]-1<=920,(id,b)
  assert s['baseY']==b[3]-1,(id,'baseY')
  for p in (s['mouth'],s['sparkle']):assert all(0<=v<=1024 for v in p.values())
  for l in s['layers']:
   assert not l.get('ground');assert parts[l['name']].size==(1024,1024)
   assert l['role'] in ('static','hinge','lift','fade','twist')
   if l['role']!='static':assert l.get('open')
   for k in l.get('open',[]):assert set(k)<=set('at x y rotate scaleX scaleY scale opacity'.split())
   for m in l.get('idle',[]):
    assert 'type'in m
    if m['type']=='drift':assert id=='dim-sum-steamer' and l['name']=='steam'
   if l['role']=='static':
    assert not l.get('open');bb=bbox(parts[l['name']]);assert bb and all(0<=v<=1024 for v in bb)
  if id=='bento':
   assert [l['name']for l in s['layers']]==['box','lid','knot'];assert s['layers'][2]['open'][1]=={'at':.35,'opacity':0};assert s['layers'][1]['open'][1]=={'at':.35,'y':0,'opacity':1}
  if id=='heart-locket':
   assert not s.get('idle');assert not s['layers'][0].get('idle');assert all(l['idle'][0]['deg']==4 for l in s['layers'][1:])
  if id=='camp-lantern':
   glow=next(l for l in s['layers']if l['name']=='glow');assert [k['opacity']for k in glow['open']]==[1,1];assert parts['glow'].getchannel('A').getextrema()[1]<200
  for l in s['layers']:
   if l['role']in ('lift','twist'):assert l['open'][-1].get('opacity')==0
  paths=[V/f'vessel-{id}.png']+[V/l['file']for l in s['layers']]+([V/s['glint']]if s.get('glint')else [])
  for p in paths:
   a=Image.open(p).convert('RGBA');assert all(a.getchannel('A').getpixel(pt)==0 for pt in [(0,0),(1023,0),(0,1023),(1023,1023)])
   w=Image.open(REPO/'public/art/vessels'/p.with_suffix('.webp').name).convert('RGBA');assert w.size==(512,512);assert all(w.getchannel('A').getpixel(pt)==0 for pt in [(0,0),(511,0),(0,511),(511,511)]);exports+=1
   e=next(e for e in entries if e['path']=='design/art/vessels/'+p.name);assert e['model']=='gpt-image-2' and e['prompt'];assert e['size_px']==[1024,1024]
  reports[id]={'closed_stack_exact':True,'canvas':[1024,1024],'bbox_alpha_gt_25':b,'baseY':s['baseY'],'all_static_gifts_inside_canvas':True,'covers_clear_at_end':True,'export_count':len(paths),'ip_review':'Original generic object; no logo, characters, text, real flag or brand shape.'}
 # Preserve every master/export already present on main, plus Roy's approved balloon.
 preserved=0
 for ref,only_balloon in [('origin/main',False),('3563b75',True)]:
  listing=subprocess.check_output(['git','ls-tree','-r',ref,'--','design/art','public/art'],cwd=REPO).decode()
  for line in listing.splitlines():
   meta,path=line.split('\t',1)
   if not path.endswith(('.png','.webp'))or'/_checks/'in path:continue
   if only_balloon and '/vessel-hot-air-balloon'not in path:continue
   assert blob(REPO/path)==meta.split()[2],('approved art changed',ref,path);preserved+=1
 base=json.loads(subprocess.check_output(['git','show','origin/main:design/art/manifest.json'],cwd=REPO));current={e['path']:e for e in entries}
 assert all(current[e['path']]==e for e in base),'other batch metadata changed'
 scope=subprocess.check_output(['git','diff','--name-only','origin/main'],cwd=REPO).decode().splitlines();assert not any(p.startswith(('mobile/','src/','supabase/'))for p in scope)
 report={'vessels':reports,'masters_and_exports':exports,'existing_art_hash_checks':preserved,'other_batch_metadata_preserved':True,'art_only_scope':True}
 (C/'b5-validation.json').write_text(json.dumps(report,indent=2)+'\n');print('B5:',len(reports),'exact stacks;',exports,'exports;',preserved,'existing/approved art hashes; scope and metadata PASS')
if __name__=='__main__':main()
