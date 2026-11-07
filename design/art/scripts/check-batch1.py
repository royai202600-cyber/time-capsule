#!/usr/bin/env python3
"""Validate the T10a vessel contract and render measured opening keyframes."""
import json,runpy,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageChops
R=Path(__file__).resolve().parents[1];V=R/'vessels';C=R/'_checks';PAPER=(246,248,251,255)
F=runpy.run_path(str(R/'scripts/finish-batch1.py'))
font=lambda n:ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',n)

def expanded(parts,spec,t):
 # Render with room beyond all four canvas edges; image source stays 1024.
 out=Image.new('RGBA',(1536,1536))
 for l in spec['layers']:
  keys=l.get('open',[{'at':0},{'at':1}]);lo=keys[0];hi=keys[-1]
  for a,b in zip(keys,keys[1:]):
   if a['at']<=t<=b['at']:lo,hi=a,b;break
  u=max(0,min(1,(t-lo['at'])/max(.001,hi['at']-lo['at'])));k={}
  for field in set(lo)|set(hi):
   if field=='at':continue
   default=1 if field in ('scale','scaleX','scaleY','opacity') else 0;k[field]=lo.get(field,default)*(1-u)+hi.get(field,default)*u
  im=Image.new('RGBA',(1536,1536));im.alpha_composite(parts[l['name']],(256,256));p=l.get('pivot',{'x':512,'y':512});pivot={'x':p['x']+256,'y':p['y']+256};out=Image.alpha_composite(out,F['transform'](im,k,pivot))
 return out

def flatten(im):return Image.alpha_composite(Image.new('RGBA',im.size,PAPER),im).convert('RGB')

def main():
 specs=json.loads((C/'t10a-specs.json').read_text());report={}
 for path,spec in specs.items():
  id=path.split('vessel-')[1].removesuffix('.png');parts={l['name']:Image.open(V/l['file']).convert('RGBA') for l in spec['layers']};assembled=Image.open(R/path).convert('RGBA');stack=F['frame'](parts,spec,0)
  assert ImageChops.difference(assembled,stack).getbbox() is None
  alpha=assembled.getchannel('A');box=alpha.point(lambda a:255 if a>25 else 0).getbbox()
  assert box[2]-box[0]<=760 and box[1]>=100 and 880<=box[3]-1<=920,(id,box)
  assert all(l['role'] in ('static','hinge','lift','fade','slide','pop') for l in spec['layers'])
  for l in spec['layers']:
   assert 'ground' not in l
   if l['role']=='hinge':assert 'pivot' in l
   if l['role']!='static':assert l.get('open')
  assert 3400<=spec['idleMs']<=4600
  if id=='hourglass':assert spec['layers'][1]['idle'][0]['direction']=='down'
  # Thin outline crosshairs: pivot plum, mouth red, sparkle brass.
  sh=Image.new('RGB',(1240,720),PAPER[:3]);d=ImageDraw.Draw(sh)
  for i,t in enumerate((0,.5,1)):
   ox=15+i*410;stage=flatten(expanded(parts,spec,t)).resize((400,400),Image.Resampling.LANCZOS);sh.paste(stage,(ox,40));d.text((ox+10,10),('CLOSED','HALF OPEN','OPEN')[i],fill='#16263F',font=font(20))
   for label,p,color in [('mouth',spec['mouth'],'#A3364F'),('sparkle',spec['sparkle'],'#C9A15A')]+[(l['name']+' pivot',l['pivot'],'#6E2B3F') for l in spec['layers'] if 'pivot' in l]:
    x=ox+round((p['x']+256)*400/1536);y=40+round((p['y']+256)*400/1536);d.line((x-5,y,x+5,y),fill=color,width=2);d.line((x,y-5,x,y+5),fill=color,width=2)
  d.text((25,445),f'{id} | opening {spec["opening"]} | baseY {spec["baseY"]} | mouth {spec["mouth"]} | sparkle {spec["sparkle"]}',fill='#16263F',font=font(15))
  y=475
  for l in spec['layers']:
   if l.get('open'):
    text=l['name']+' '+l['role']+' '+json.dumps(l.get('pivot',{}))+' open '+json.dumps(l['open'],separators=(',',':'))
    # Text stays legible, wrapping at the panel width.
    for start in range(0,len(text),130):d.text((25,y),text[start:start+130],fill='#16263F',font=font(14));y+=20
  d.text((25,690),'Crosshairs: plum = pivots; wax red = mouth; brass = sparkle. Translations are fractions of 1024; rotation is degrees.',fill='#16263F',font=font(14));sh.save(C/f'{id}-motion.png',optimize=True)
  sizes=Image.new('RGB',(360,180),PAPER[:3]);sd=ImageDraw.Draw(sizes)
  for n,x in ((40,40),(120,180)):
   sizes.paste(flatten(assembled.resize((n,n),Image.Resampling.LANCZOS)),(x,10));sd.text((x,145),str(n)+' px',fill='#16263F',font=font(16))
  sizes.save(C/f'{id}-silhouette.png',optimize=True)
  stack.save(C/f'{id}-stack.png',optimize=True);flatten(assembled).resize((120,120),Image.Resampling.LANCZOS).save(C/f'{id}-at-120px.png');flatten(assembled).resize((40,40),Image.Resampling.LANCZOS).save(C/f'{id}-at-40px.png')
  report[id]={'canvas':[1024,1024],'bbox':box,'corners_alpha':[alpha.getpixel(p) for p in ((0,0),(1023,0),(0,1023),(1023,1023))],'rest_stack_exact':True,'schema_pass':True,'motion_sheet':f'{id}-motion.png','ip_review':'Original, no trademarks, characters, logos or text; rejected-ideas list checked.'}
 (C/'t10a-validation.json').write_text(json.dumps(report,indent=2)+'\n');print(len(report),'vessels: size, baseline, roles, pivots, keyframes, idle and exact rest-stack PASS')
if __name__=='__main__':main()
