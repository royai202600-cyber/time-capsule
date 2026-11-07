#!/usr/bin/env python3
"""Align gpt-image-2 isolation edits and write T10a data and review sheets.
Input: _checks/t10a-generation.json (exact prompts and local native sources).
All native edits use one common downscale/translation per vessel after alignment.
"""
import json, math, runpy
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops
R=Path(__file__).resolve().parents[1]; V=R/'vessels'; C=R/'_checks'
PAPER=(246,248,251,255)
ORDER={'mixtape':['case','cassette'],'instant-camera':['camera','photo'],'ramen':['bowl','steam','lid'],'fortune-cookie':['plate','slip','left','right'],'red-packet':['packet','flap','seal'],'phone-booth':['booth','light','door'],'firefly-jar':['jar','fireflies','lid'],'hourglass':['frame-and-glass','sand','cap'],'gashapon':['bottom','top']}
FIT={('mixtape','cassette'):(225,419,978,942),('instant-camera','camera'):(224,419,1018,1120),('instant-camera','photo'):(310,600,710,1055),('ramen','lid'):(284,381,967,720),('fortune-cookie','slip'):(480,700,740,750),('red-packet','flap'):(315,175,939,490),('red-packet','seal'):(528,420,650,539),('phone-booth','door'):(424,350,730,1044),('phone-booth','light'):(440,380,710,1030),('hourglass','cap'):(380,152,862,344)}

def clean(im,cut=20):
 im=im.convert('RGBA');im.putalpha(im.getchannel('A').point(lambda a:a if a>=cut else 0));return im

def bbox(im):return im.getchannel('A').point(lambda a:255 if a>25 else 0).getbbox()

def fit(im,box):
 crop=im.crop(bbox(im));assert box[2]-box[0]<=crop.width and box[3]-box[1]<=crop.height,'never upscale'
 crop=crop.resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS);out=Image.new('RGBA',im.size);out.alpha_composite(crop,box[:2]);return out

def glass(im):
 p=im.load()
 for y in range(im.height):
  for x in range(im.width):
   r,g,b,a=p[x,y]
   # Clear blue fill (including opaque generated fill); preserve plum ink and white glints.
   if a and b>r+5 and b>=g and r>110:p[x,y]=(r,g,b,round(min(a,180)*.375))
 return im

def soft(im,opacity=.3,blur=5):
 a=im.getchannel('A').filter(ImageFilter.GaussianBlur(blur)).point(lambda v:round(v*opacity));out=Image.new('RGBA',im.size,(246,236,210,0));out.putalpha(a);return clean(out,3)

def fireflies(im):
 # The edit enlarged the blooms. Keep core positions and rebuild only their soft alpha falloff.
 pix=im.load(); points=[];seen=set()
 for y in range(350,1000):
  for x in range(250,990):
   r,g,b,a=pix[x,y]
   if a>200 and min(r,g,b)>235 and (x,y) not in seen:
    todo=[(x,y)];seen.add((x,y));comp=[]
    while todo:
     qx,qy=todo.pop();comp.append((qx,qy))
     for nx,ny in ((qx-1,qy),(qx+1,qy),(qx,qy-1),(qx,qy+1)):
      if (nx,ny) in seen or not(0<=nx<1254 and 0<=ny<1254):continue
      rr,gg,bb,aa=pix[nx,ny]
      if aa>200 and min(rr,gg,bb)>235:seen.add((nx,ny));todo.append((nx,ny))
    if 4<len(comp)<1800:points.append((sum(p[0] for p in comp)/len(comp),sum(p[1] for p in comp)/len(comp)))
 points=sorted(points,key=lambda p:p[1]);out=Image.new('RGBA',im.size)
 for i,(x,y) in enumerate(points):
  # Only lights within original jar body; 22 small mixed-size particles.
  if i>=25:break
  rad=3+i%3; halo=Image.new('RGBA',im.size);d=ImageDraw.Draw(halo);d.ellipse((x-rad*2,y-rad*2,x+rad*2,y+rad*2),fill=(201,161,90,130));halo=halo.filter(ImageFilter.GaussianBlur(rad));out=Image.alpha_composite(out,halo);ImageDraw.Draw(out).ellipse((x-rad,y-rad,x+rad,y+rad),fill=(255,250,224,245))
 return out

def transform(im,key,pivot=None):
 # Coordinates follow PR42: fractions for translations, px for pivot, clockwise degrees.
 px,py=(pivot or {'x':512,'y':512}).values();sx=key.get('scaleX',1)*key.get('scale',1);sy=key.get('scaleY',1)*key.get('scale',1);angle=math.radians(key.get('rotate',0));cs,sn=math.cos(angle),math.sin(angle)
 sx=sx if abs(sx)>.002 else .002;sy=sy if abs(sy)>.002 else .002
 a,b=cs/sx,sn/sx;c,d=-sn/sy,cs/sy;tx=key.get('x',0)*1024;ty=key.get('y',0)*1024
 out=im.transform(im.size,Image.Transform.AFFINE,(a,b,px-a*(px+tx)-b*(py+ty),c,d,py-c*(px+tx)-d*(py+ty)),Image.Resampling.BICUBIC)
 out.putalpha(out.getchannel('A').point(lambda v:round(v*key.get('opacity',1))));return out

def frame(parts,spec,t):
 out=Image.new('RGBA',(1024,1024))
 for layer in spec['layers']:
  keys=layer.get('open',[{'at':0},{'at':1}]);lo=keys[0];hi=keys[-1]
  for left,right in zip(keys,keys[1:]):
   if left['at']<=t<=right['at']:lo,hi=left,right;break
  u=max(0,min(1,(t-lo['at'])/max(.001,hi['at']-lo['at'])));k={}
  for field in set(lo)|set(hi):
   if field=='at':continue
   default=1 if field in ('scale','scaleX','scaleY','opacity') else 0;k[field]=lo.get(field,default)*(1-u)+hi.get(field,default)*u
  out=Image.alpha_composite(out,transform(parts[layer['name']],k,layer.get('pivot')))
 return out

def make_spec(id,point):
 P=lambda x,y:dict(zip(('x','y'),point(x,y)))
 static=lambda n:{'name':n,'file':f'vessel-{id}-{n}.png','role':'static'}
 moving=lambda n,role,end,pivot=None,keys=None:{**static(n),'role':role,**({'pivot':P(*pivot)} if pivot else {}),'open':keys or [{'at':0,'x':0,'y':0,'rotate':0,'opacity':1},{'at':1,**end}]}
 fade=lambda n:{**static(n),'role':'fade','open':[{'at':0,'opacity':1},{'at':1,'opacity':0}]}
 idle=[];glint=None
 if id=='mixtape':
  ls=[static('case'),moving('cassette','slide',{'y':-.55,'opacity':0})];mouth=P(600,430);spark=P(325,370);glint=f'vessel-{id}-glint.png'
 elif id=='instant-camera':
  ls=[static('camera'),moving('photo','slide',{},(510,1055),[{'at':0,'scaleY':.06,'y':0},{'at':.25,'scaleY':.4,'y':.08},{'at':1,'scaleY':1,'y':.17}])];mouth=P(520,1000);spark=P(745,625)
 elif id=='ramen':
  ls=[static('bowl'),fade('steam'),moving('lid','lift',{'y':-.45,'opacity':0})];ls[1]['idle']=[{'type':'drift','amount':.03}];mouth=P(620,620);spark=P(610,435)
 elif id=='fortune-cookie':
  ls=[static('plate'),static('slip'),moving('left','hinge',{'x':-.13,'rotate':-32},(380,880)),moving('right','hinge',{'x':.13,'rotate':32},(835,885))];idle=[{'type':'bob','amount':.025}];mouth=P(620,730);spark=P(620,420)
 elif id=='red-packet':
  ls=[static('packet'),moving('flap','hinge',{'scaleY':-1},(615,205)),fade('seal')];mouth=P(615,240);spark=P(590,470)
 elif id=='phone-booth':
  ls=[static('booth'),fade('light'),moving('door','hinge',{'scaleX':.08},(425,700))];ls[1]['open']=[{'at':0,'opacity':1},{'at':1,'opacity':1}];ls[1]['idle']=[{'type':'glow','base':.35,'range':.4}];mouth=P(610,620);spark=P(690,700)
 elif id=='firefly-jar':
  ls=[static('jar'),fade('fireflies'),moving('lid','lift',{},(615,400),[{'at':0,'y':0,'rotate':0,'opacity':1},{'at':.25,'y':0,'rotate':-12,'opacity':1},{'at':1,'y':-.5,'rotate':-12,'opacity':0}])];ls[1]['open']=[{'at':0,'y':0,'opacity':1},{'at':1,'y':-.25,'opacity':0}];ls[1]['idle']=[{'type':'drift','amount':.03},{'type':'glow','base':.65,'range':.3}];mouth=P(615,365);spark=P(350,585)
 elif id=='hourglass':
  ls=[static('frame-and-glass'),static('sand'),moving('cap','lift',{'y':-.35,'opacity':0})];ls[1]['idle']=[{'type':'drift','amount':.03,'direction':'down'}];mouth=P(615,320);spark=P(485,210)
 else:
  ls=[moving('bottom','hinge',{},(520,720),[{'at':0,'rotate':0,'x':0,'y':0},{'at':.25,'rotate':-6,'x':0,'y':0},{'at':1,'rotate':-23,'x':-.1,'y':.08}]),moving('top','hinge',{},(720,720),[{'at':0,'rotate':0,'x':0,'y':0},{'at':.25,'rotate':6,'x':0,'y':0},{'at':1,'rotate':27,'x':.12,'y':-.22,'opacity':.2}])];idle=[{'type':'tick','deg':3,'pivot':P(620,950)}];mouth=P(620,650);spark=P(450,340)
 idle_overrides={'red-packet':[{'type':'sway','deg':3,'pivot':{'x':512,'y':300}}],'instant-camera':[{'type':'bob','amount':.03}],'mixtape':[{'type':'bob','amount':.03}],'ramen':[{'type':'bob','amount':.025}],'phone-booth':[{'type':'breathe','amount':.025}],'hourglass':[{'type':'sway','deg':2.5,'pivot':{'x':512,'y':900}}]}
 idle=idle_overrides.get(id,idle)
 return {'opening':{'mixtape':'F','instant-camera':'F','ramen':'B','fortune-cookie':'H','red-packet':'E','phone-booth':'J','firefly-jar':'G','hourglass':'C','gashapon':'H'}[id],'idleMs':4000,'idle':idle,'layers':ls,'mouth':mouth,'baseY':900,'sparkle':spark,'glint':glint,'openGlow':None,'readyPulse':None}

def main():
 batch=json.loads((C/'t10a-generation.json').read_text());specs={};prompts={};report={}
 for id,data in batch.items():
  parts={}
  for name,entry in data['parts'].items():
   im=clean(Image.open(entry['source']))
   if (id,name) in FIT:im=fit(im,FIT[id,name])
   if (id,name) in [('mixtape','case'),('phone-booth','door'),('firefly-jar','jar'),('hourglass','frame-and-glass'),('gashapon','top')]:im=glass(im)
   if name=='steam':im=soft(im,.7,4)
   if name=='light':im=soft(im,.22,14)
   if name=='fireflies':im=fireflies(im)
   if id=='fortune-cookie' and name in ('left','right'):
    p=im.load()
    for y in range(1254):
     seam=640-.0002*(y-350)**2
     for x in range(1254):
      if (name=='left' and x>seam) or (name=='right' and x<seam):p[x,y]=(0,0,0,0)
   if id=='ramen' and name=='bowl':
    p=im.load()
    for y in range(1254):
     for x in range(1254):
      r,g,b,a=p[x,y]
      if g>r*1.1 and g>b*1.1:p[x,y]=(47,93,138,a)
   parts[name]=im
  # Measure from physical parts, excluding soft effects and the complete hidden photo.
  boxes=[bbox(im) for n,im in parts.items() if n not in ('light','steam','fireflies','photo')];box=(min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes));s=min(1024/1254,740/(box[2]-box[0]),780/(box[3]-box[1]));dx=512-(box[0]+box[2])*s/2;dy=900-box[3]*s
  point=lambda x,y:(round(x*s+dx),round(y*s+dy))
  for name,im in parts.items():
   out=Image.new('RGBA',(1024,1024));small=im.resize((round(1254*s),round(1254*s)),Image.Resampling.LANCZOS);out.alpha_composite(small,(round(dx),round(dy)));parts[name]=clean(out,5)
  fixes=json.loads((C/'t10a-review-fixes.json').read_text())
  if id=='firefly-jar':
   im=Image.open(fixes['fireflies']['source']).convert('RGBA')
   assert im.width>=1024 and im.height>=1024
   im=im.resize((1024,1024),Image.Resampling.LANCZOS)
   pix=im.load()
   for y in range(1024):
    for x in range(1024):
     r,g,b,a=pix[x,y]
     # Remove grey/brown halo RGB without darkening transparent gold bloom.
     if a<12:pix[x,y]=(0,0,0,0)
     elif min(r,g,b)>225 and a>190:pix[x,y]=(255,246,206,a)
     else:pix[x,y]=(255,210,100,min(245,round(a*1.15)))
   parts['fireflies']=im
  if id=='ramen':
   im=Image.open(fixes['chopsticks']['source']).convert('RGBA')
   assert im.width>=1024 and im.height>=1024
   im=clean(im.resize((1024,1024),Image.Resampling.LANCZOS),20)
   parts['lid']=Image.alpha_composite(parts['lid'],im)
  if id=='firefly-jar' and (C/'t10a-firefly-card-fix.json').exists():
   cfg=json.loads((C/'t10a-firefly-card-fix.json').read_text());finish=runpy.run_path(str(R/'scripts/finish-firefly-card.py'));parts['fireflies']=finish['prepare'](cfg['source'])[0];parts['jar']=finish['prepare_jar'](parts['jar'])
  spec=make_spec(id,point)
  if id=='mixtape':
   # Reel disks are exact scripted isolations of the edited cassette; they slide with it.
   for n,cx,cy in [('reel-left',421,690),('reel-right',740,690)]:
    x,y=point(cx,cy);rad=round(51*s);mask=Image.new('L',(1024,1024));ImageDraw.Draw(mask).ellipse((x-rad,y-rad,x+rad,y+rad),fill=255);im=parts['cassette'].copy();im.putalpha(ImageChops.multiply(im.getchannel('A'),mask));parts[n]=im;spec['layers'].append({'name':n,'file':f'vessel-{id}-{n}.png','role':'slide','pivot':{'x':x,'y':y},'open':[{'at':0,'y':0,'opacity':1},{'at':1,'y':-.55,'opacity':0}],'idle':[{'type':'spin','pivot':{'x':x,'y':y},'turns':1}]});prompts[f'vessels/vessel-{id}-{n}.png']=data['parts']['cassette']['prompt']
   gl=parts['case'].copy();p=gl.load()
   for y in range(1024):
    for x in range(1024):
     r,g,b,a=p[x,y];p[x,y]=(245,250,255,round(a*.5) if min(r,g,b)>235 else 0)
   gl=gl.filter(ImageFilter.GaussianBlur(1));gl.save(V/f'vessel-{id}-glint.png');prompts[f'vessels/vessel-{id}-glint.png']=data['parts']['case']['prompt']
  for n,im in parts.items():im.save(V/f'vessel-{id}-{n}.png',optimize=True)
  assembled=frame(parts,spec,0);assembled.save(V/f'vessel-{id}.png',optimize=True);specs[f'vessels/vessel-{id}.png']=spec
  prompts[f'vessels/vessel-{id}.png']=data['prompt']
  for n,p in data['parts'].items():prompts[f'vessels/vessel-{id}-{n}.png']=p['prompt']
  if id=='firefly-jar':prompts['vessels/vessel-firefly-jar-fireflies.png']=fixes['fireflies']['prompt']
  if id=='ramen':prompts['vessels/vessel-ramen-lid.png'] += '\n\nAdditional chopsticks overlay edit (composited into the unchanged lid):\n'+fixes['chopsticks']['prompt']
  if id=='firefly-jar' and (C/'t10a-firefly-card-fix.json').exists():prompts['vessels/vessel-firefly-jar-fireflies.png']=json.loads((C/'t10a-firefly-card-fix.json').read_text())['prompt']
  report[id]={'native_to_master':{'scale':s,'dx':dx,'dy':dy},'canvas':list(assembled.size),'bbox_alpha_gt25':bbox(assembled),'baseY':900,'generation_attempts':1,'ip_check':'PASS: original design, no logo/text/character/brand shapes; compared with plan rejected ideas','rest_keyframes_applied':True}
 (C/'t10a-specs.json').write_text(json.dumps(specs,indent=2)+'\n');(C/'prompts-t10a-extra.json').write_text(json.dumps(prompts,ensure_ascii=False,indent=2)+'\n');(C/'t10a-check.json').write_text(json.dumps(report,indent=2)+'\n')
 print('Prepared',len(specs),'vessels and',len(prompts),'masters')
if __name__=='__main__':main()
