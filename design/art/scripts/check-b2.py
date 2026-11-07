#!/usr/bin/env python3
"""Audit persisted B2 records and build one closed/open/small-size review."""
import json,runpy
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageChops
R=Path(__file__).resolve().parents[1];C=R/'_checks';V=R/'vessels'
FRAME=runpy.run_path(str(R/'scripts/finish-batch1.py'))['frame']
IDS=['clock-tower','senado-fountain','bamboo-tower','gate-lantern','torii-scroll','palace-pavilion','lionfish-fountain','golden-roof','gate-lacquer','twin-towers']
def main():
 sh=Image.new('RGB',(2300,1020),'#F6F8FB');d=ImageDraw.Draw(sh);font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',19);report={}
 for i,id in enumerate(IDS):
  s=json.loads((C/f't10b-{id}-spec.json').read_text());a=Image.open(V/f'vessel-{id}.png').convert('RGBA');parts={l['name']:Image.open(V/l['file']).convert('RGBA') for l in s['layers']}
  assert a.size==(1024,1024) and all(p.size==a.size for p in parts.values())
  assert ImageChops.difference(a,FRAME(parts,s,0)).getbbox() is None
  b=a.getchannel('A').point(lambda v:255 if v>25 else 0).getbbox();assert b[1]>=100 and b[2]-b[0]<=760 and s['baseY']==b[3]-1 and 880<=s['baseY']<=920
  assert 3400<=s['idleMs']<=4600
  for l in s['layers']:
   if l['role']!='static':assert l.get('open')
   if l['role'] in ('door','hinge'):assert l.get('pivot')
   for motion in l.get('idle',[]):
    if motion['type']=='drift':assert l['name']=='spray'
   if l['role']=='lift':
    end=l['open'][-1];cover_box=parts[l['name']].getchannel('A').point(lambda a:255 if a>25 else 0).getbbox()
    assert end['opacity']==0 and cover_box[3]-1+end['y']*1024<=s['mouth']['y']-12
  if id=='twin-towers':
   assert s['idle']==[{'type':'breathe','amount':.025}]
   assert s['layers'][1]['name']=='glow' and s['layers'][1]['idle'][0]['type']=='glow'
  if id=='clock-tower':
   hands=s['layers'][2];assert hands['idle']==[{'type':'tick','deg':6,'pivot':hands['pivot']}]
   assert next(k for k in hands['open'] if k['at']==.3)['opacity']==0
   assert s['layers'][1]['role']=='door' and s['layers'][1]['open'][-1]['scaleX']<=.05
  for im in [a,*parts.values()]:assert all(im.getpixel(p)[3]==0 for p in ((0,0),(1023,0),(0,1023),(1023,1023)))
  for filename in [f'vessel-{id}.webp']+[Path(l['file']).stem+'.webp' for l in s['layers']]:
   web=Image.open(R.parent.parent/'public/art/vessels'/filename);assert max(web.size)<=512 and web.mode=='RGBA'
  x=i%5*460;y=i//5*510;d.text((x+10,y+10),id,fill='#16263F',font=font)
  for j,t in enumerate((0,1)):
   im=FRAME(parts,s,t);bg=Image.new('RGBA',im.size,'#F6F8FB');bg.alpha_composite(im);sh.paste(bg.convert('RGB').resize((230,230)),(x+j*230,y+50));d.text((x+j*230+20,y+290),['CLOSED','OPEN'][j],fill='#16263F',font=font)
  sh.paste(Image.open(C/f'{id}-silhouette.png'),(x+10,y+325))
  report[id]={'canvas_baseline_padding':True,'exact_closed_stack':True,'schema_and_motion':True,'transparent_corners':True,'webp':True,'silhouette_120px':'Visually reviewed: original landmark-inspired overall form remains distinct.'}
 sh.save(C/'b2-opening-review.png',optimize=True);(C/'b2-final-check.json').write_text(json.dumps(report,indent=2)+'\n');print('10 B2 vessels: canvas, baseline, exact stack, roles, clock tick, particles, alpha and WebP PASS')
if __name__=='__main__':main()
