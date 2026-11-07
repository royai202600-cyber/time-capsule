#!/usr/bin/env python3
"""Audit B3 rest keyframes and generate measured review sheets."""
import json,runpy,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageChops
R=Path(__file__).resolve().parents[1];C=R/'_checks';V=R/'vessels';P=(246,248,251,255)
F=runpy.run_path(str(R/'scripts/finish-b3.py'));render=F['render'];box=F['box']
def flat(im):return Image.alpha_composite(Image.new('RGBA',im.size,P),im).convert('RGB')
def font(n):return ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',n)
def expanded(parts,spec,t):
 padded={n:Image.new('RGBA',(1536,1536)) for n in parts}
 for n,im in parts.items():padded[n].alpha_composite(im,(256,256))
 ss=json.loads(json.dumps(spec))
 for l in ss['layers']:
  p=l.get('pivot',{'x':512,'y':512});l['pivot']={'x':p['x']+256,'y':p['y']+256}
 # render's output canvas is 1024; duplicate its code with output sized from the layers.
 import inspect
 code=inspect.getsource(render).replace('def render(parts,spec,t):','def bigrender(parts,spec,t):').replace("(1024,1024)","(1536,1536)")
 env=dict(F);exec(code,env);return env['bigrender'](padded,ss,t)
def main():
 specs=json.loads((C/'b3-specs.json').read_text());specs['lucky-cat']=json.loads((C/'b3-lucky-cat-spec.json').read_text());report={};contact=Image.new('RGB',(1250,530),P[:3]);cd=ImageDraw.Draw(contact)
 for idx,(id,spec) in enumerate(specs.items()):
  parts={l['name']:Image.open(V/l['file']).convert('RGBA') for l in spec['layers']};assembled=Image.open(V/f'vessel-{id}.png').convert('RGBA');closed=render(parts,spec,0);bbox=box(assembled)
  exact=all(ImageChops.difference(assembled,closed).getchannel(c).getbbox() is None for c in 'RGBA')
  corners=all(im.getchannel('A').getpixel(p)==0 for im in [assembled,*parts.values()] for p in ((0,0),(1023,0),(0,1023),(1023,1023)))
  errors=[]
  if not exact:errors.append('closed stack')
  if not corners:errors.append('corners')
  if bbox[2]-bbox[0]>760 or bbox[1]<100 or not 880<=bbox[3]-1<=920:errors.append('geometry')
  if spec['baseY']!=bbox[3]-1:errors.append('baseY')
  if id=='lucky-cat':
   full=box(expanded(parts,spec,1));inside=all(v>=256 for v in full[:2]) and all(v<=1280 for v in full[2:]);
   if not inside:errors.append('open canvas')
  for l in spec['layers']:
   assert l.get('ground',False)==(id=='river-lantern' and l['name']=='water')
  sheet=Image.new('RGB',(1240,720),P[:3]);d=ImageDraw.Draw(sheet)
  for i,t in enumerate((0,.5,1)):
   ox=15+i*410;im=flat(expanded(parts,spec,t)).resize((400,400),Image.Resampling.LANCZOS);sheet.paste(im,(ox,40));d.text((ox+10,10),('CLOSED','HALF OPEN','OPEN')[i],fill='#16263F',font=font(20))
   anchors=[(spec['mouth'],'#A3364F'),(spec['sparkle'],'#C9A15A')]+[(l['pivot'],'#6E2B3F') for l in spec['layers'] if 'pivot'in l]
   for p,col in anchors:
    x=ox+round((p['x']+256)*400/1536);y=40+round((p['y']+256)*400/1536);d.line((x-5,y,x+5,y),fill=col,width=2);d.line((x,y-5,x,y+5),fill=col,width=2)
  lines=[f'{id} | opening {spec["opening"]} | baseY {spec["baseY"]} | mouth {spec["mouth"]} | sparkle {spec["sparkle"]}']
  for l in spec['layers']:
   if l.get('open'):lines.append(l['name']+' '+l['role']+' '+json.dumps(l.get('pivot',{}))+' '+json.dumps(l['open'],separators=(',',':')))
  y=450
  for line in lines:
   for start in range(0,len(line),150):d.text((22,y),line[start:start+150],fill='#16263F',font=font(13));y+=20
  d.text((22,690),'Crosshairs: plum = pivot; wax red = mouth; brass = sparkle. x/y in fractions of 1024.',fill='#16263F',font=font(14));sheet.save(C/f'{id}-motion.png',optimize=True)
  closed.save(C/f'{id}-stack.png',optimize=True)
  strip=Image.new('RGB',(360,180),P[:3]);sd=ImageDraw.Draw(strip)
  for n,x in ((40,40),(120,180)):
   small=flat(assembled).resize((n,n),Image.Resampling.LANCZOS);small.save(C/f'{id}-at-{n}px.png');strip.paste(small,(x,10));sd.text((x,145),f'{n} px',fill='#16263F',font=font(16))
  strip.save(C/f'{id}-silhouette.png',optimize=True)
  x=(idx%5)*250;y=(idx//5)*265;contact.paste(flat(assembled).resize((230,230),Image.Resampling.LANCZOS),(x+10,y));cd.text((x+10,y+235),id,fill='#16263F',font=font(16))
  report[id]={'closed_stack_exact':exact,'bbox':bbox,'corners_zero':corners,'errors':errors,'ip_review':'Original generic festival object; no logo, text, known character or branded shape.'}
  print(id,bbox,'PASS'if not errors else errors)
 contact.save(C/'b3-contact-sheet.png',optimize=True);(C/'b3-validation.json').write_text(json.dumps(report,indent=2)+'\n')
 if any(r['errors']for r in report.values()):raise SystemExit(1)
if __name__=='__main__':main()
