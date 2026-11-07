#!/usr/bin/env python3
"""Align B3 isolation edits; extract moving pixels from each assembled source."""
import json, math, runpy
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops, ImageFilter
R=Path(__file__).resolve().parents[1]; C=R/'_checks'; V=R/'vessels'
IDS=['mooncake-tin','cake-box','candy-box','chocolate-heart','stocking','pumpkin','rice-dumpling','wish-tag','river-lantern']

def box(im): return im.getchannel('A').point(lambda a:255 if a>25 else 0).getbbox()
def poly(points):
 m=Image.new('L',(1254,1254)); ImageDraw.Draw(m).polygon(points,fill=255); return m
def rect(b):
 m=Image.new('L',(1254,1254)); ImageDraw.Draw(m).rectangle(b,fill=255); return m
def cut(im,m):
 out=im.copy();out.putalpha(ImageChops.multiply(im.getchannel('A'),m));return out
def inverse(m):return ImageChops.invert(m)
def clean(im):
 im=im.convert('RGBA');im.putalpha(im.getchannel('A').point(lambda a:a if a>=15 else 0));return im
def fit(im,b):
 crop=im.crop(box(im)); assert crop.width>=b[2]-b[0] and crop.height>=b[3]-b[1]
 out=Image.new('RGBA',im.size);out.alpha_composite(crop.resize((b[2]-b[0],b[3]-b[1]),Image.Resampling.LANCZOS),b[:2]);return out

def glow_layer(size,xy,rad):
 out=Image.new('RGBA',size);h=Image.new('RGBA',size);d=ImageDraw.Draw(h);x,y=xy
 d.ellipse((x-rad,y-rad,x+rad,y+rad),fill=(201,161,90,190));h=h.filter(ImageFilter.GaussianBlur(rad*.45));out.alpha_composite(h)
 d=ImageDraw.Draw(out);d.ellipse((x-rad*.30,y-rad*.45,x+rad*.30,y+rad*.2),fill=(255,242,198,245));return out

def render(parts,spec,t):
 transform=runpy.run_path(str(R/'scripts/finish-batch1.py'))['transform'];out=Image.new('RGBA',(1024,1024))
 for l in spec['layers']:
  keys=l.get('open',[{'at':0},{'at':1}]);lo=keys[0];hi=keys[-1]
  for a,b in zip(keys,keys[1:]):
   if a['at']<=t<=b['at']:lo,hi=a,b;break
  u=max(0,min(1,(t-lo['at'])/max(.001,hi['at']-lo['at'])));k={}
  for f in set(lo)|set(hi):
   if f=='at':continue
   default=1 if f in ('opacity','scale','scaleX','scaleY') else 0;k[f]=lo.get(f,default)*(1-u)+hi.get(f,default)*u
  if k.get('opacity',1)==0:continue
  im=parts[l['name']]
  if any(abs(v-(1 if f in ('opacity','scale','scaleX','scaleY') else 0))>1e-8 for f,v in k.items()):im=transform(im,k,l.get('pivot'))
  out=Image.alpha_composite(out,im)
 return out

def main():
 specs={};prompts={};cfg=json.loads((C/'b3-sources.json').read_text())
 for id in IDS:
  src=clean(Image.open(C/f'b3-{id}-source.png'));body=clean(Image.open(C/f'b3-{id}-body-edit.png'));parts={};native={};idle=[];opening='B';mouth=(620,600);spark=(500,400)
  if id in ('mooncake-tin','candy-box','chocolate-heart','cake-box','pumpkin'):
   contours={
    'mooncake-tin':[(150,0),(1090,0),(1090,660),(1060,735),(1000,790),(850,843),(640,868),(430,850),(260,795),(180,724),(150,660)],
    'candy-box':[(180,0),(1070,0),(1070,650),(1030,750),(930,830),(780,890),(630,913),(470,885),(320,830),(225,750),(190,650)],
    'chocolate-heart':[(190,0),(1040,0),(1040,660),(1000,760),(850,870),(660,965),(510,986),(365,925),(245,810),(195,690)],
    'cake-box':[(200,0),(1040,0),(1040,475),(870,586),(210,563)],
    'pumpkin':[(355,0),(862,0),(862,450),(840,480),(730,506),(590,514),(455,492),(370,464)]}
   lidmask=poly(contours[id]);parts={'box' if id in ('candy-box','chocolate-heart','cake-box') else 'tin' if id=='mooncake-tin' else 'pumpkin':body,'lid':cut(src,lidmask)}
   if id=='cake-box':
    parts['flame']=glow_layer(src.size,(570,667),46);mouth=(620,455);spark=(560,665);idle=[{'type':'bob','amount':.025}]
   elif id=='pumpkin':
    parts['interior']=body.copy();parts['glow']=glow_layer(src.size,(592,807),80);mouth=(610,455);spark=(620,340);opening='C'
    # Dark translucent mouth transmits a behind-body glow; the ink rim stays opaque.
    p=body.load()
    for y in range(744,897):
     for x in range(445,734):
      r,g,b,a=p[x,y]
      if b>r*1.15 and b>g:p[x,y]=(r,g,b,0)
   elif id=='mooncake-tin':opening='A';mouth=(615,630);spark=(550,440);idle=[{'type':'breathe','amount':.025}]
   elif id=='candy-box':opening='A';mouth=(620,585);spark=(615,505);idle=[{'type':'breathe','amount':.025}]
   else:mouth=(615,640);spark=(570,590);idle=[{'type':'breathe','amount':.03}]
  elif id=='stocking':
   # Keep the stand fixed while the knitted stocking and letter sway at the hook.
   hook=rect((776,0,1253,1253));hook=ImageChops.lighter(hook,rect((0,1004,1253,1253)));hook=ImageChops.lighter(hook,rect((0,0,1253,192)))
   knob=Image.new('L',src.size);ImageDraw.Draw(knob).ellipse((606,193,661,248),fill=255);hook=ImageChops.lighter(hook,knob)
   lm=poly([(412,350),(630,300),(662,393),(444,455),(413,420)])
   parts={'hook':cut(src,hook),'stocking':cut(src,inverse(ImageChops.lighter(hook,lm))),'letter':fit(body,(420,307,651,507))}
   opening='K';mouth=(550,411);spark=(634,218)
  elif id=='rice-dumpling':
   leaf=poly([(478,488),(596,269),(639,255),(767,424),(772,486),(701,552),(510,643)])
   sm=poly([(325,663),(920,663),(925,755),(780,798),(780,866),(708,881),(718,1015),(650,1015),(616,842),(566,962),(517,960),(553,812),(455,800),(327,750)])
   # Keep only warm cream rope pixels and their ink border inside the trace.
   warm=Image.new('L',src.size);wp=warm.load();sp=src.load()
   for yy in range(660,1020):
    for xx in range(310,940):
     rr,gg,bb,aa=sp[xx,yy]
     if aa and rr>gg*1.05 and rr>bb*1.05 and rr>100:wp[xx,yy]=255
   sm=ImageChops.multiply(sm,warm.filter(ImageFilter.MaxFilter(7)))
   fixed=Image.composite(body,src,ImageChops.lighter(leaf,sm))
   parts={'dumpling':fixed,'string':cut(src,sm),'leaf':cut(src,leaf)}
   opening='E';mouth=(621,574);spark=(620,758);idle=[{'type':'bob','amount':.025}]
  elif id=='wish-tag':
   tag=poly([(581,446),(777,433),(814,785),(610,803)]);knot=poly([(624,311),(707,311),(709,485),(663,496),(646,397)])
   parts={'bamboo':body,'knot':cut(src,knot),'tag':cut(src,tag)};mouth=(685,478);spark=(682,479)
  else:
   # Complete a quiet ground pool behind the lotus, then retain its visible ripples.
   water=Image.new('RGBA',src.size);d=ImageDraw.Draw(water);d.ellipse((149,918,1101,1077),fill=(47,93,138,255))
   mask=Image.new('L',src.size);pp=src.load();mp=mask.load()
   for y in range(910,1080):
    for x in range(140,1110):
     r,g,b,a=pp[x,y]
     if a and b>r*1.1 and b>g:mp[x,y]=255
   water=Image.alpha_composite(water,cut(src,mask))
   lm=poly([(240,0),(1009,0),(1009,810),(960,914),(840,978),(620,1005),(408,978),(290,905),(240,810)])
   top=poly([(378,0),(869,0),(869,469),(750,509),(627,522),(499,491),(386,476)])
   lantern=cut(body,lm);interior=lantern.copy();p=lantern.load()
   for y in range(585,658):
    for x in range(500,749):
     r,g,b,a=p[x,y]
     if b>r*1.15 and b>g:p[x,y]=(r,g,b,0)
   parts={'water':water,'interior':interior,'glow':glow_layer(src.size,(626,620),90),'lantern':lantern,'top':cut(src,top)};opening='C';mouth=(625,618);spark=(625,325);idle=[{'type':'float','amount':.03}]
  b=box(src);s=min(1024/1254,738/(b[2]-b[0]),795/(b[3]-b[1]));dx=512-(b[0]+b[2])*s/2;dy=900-b[3]*s
  pt=lambda p:{'x':round(p[0]*s+dx),'y':round(p[1]*s+dy)}
  for name,im in parts.items():
   small=im.resize((round(1254*s),round(1254*s)),Image.Resampling.LANCZOS);out=Image.new('RGBA',(1024,1024));out.alpha_composite(small,(round(dx),round(dy)));out.putalpha(out.getchannel('A').point(lambda a:a if a>=8 else 0));native[name]=out;out.save(V/f'vessel-{id}-{name}.png',optimize=True)
  layer=lambda n,role='static',**kw:{'name':n,'file':f'vessel-{id}-{n}.png','role':role,**kw}
  fade=lambda n:layer(n,'fade',open=[{'at':0,'opacity':1},{'at':1,'opacity':0}])
  lift=lambda n:layer(n,'lift',open=[{'at':0,'y':0,'opacity':1},{'at':1,'y':-.55,'opacity':0}])
  if id in ('mooncake-tin','candy-box'):
   hinge=(615,403) if id=='mooncake-tin' else (620,300)
   layers=[layer('tin' if id=='mooncake-tin' else 'box'),layer('lid','hinge',pivot=pt(hinge),open=[{'at':0,'scaleY':1,'opacity':1},{'at':1,'scaleY':-.85,'opacity':1}])]
  elif id=='chocolate-heart':layers=[layer('box'),lift('lid')]
  elif id=='cake-box':
   layers=[layer('box'),fade('flame'),lift('lid')];layers[1]['idle']=[{'type':'glow','base':.7,'range':.3,'flicker':.12}]
  elif id=='pumpkin':
   layers=[layer('interior'),fade('glow'),layer('pumpkin'),lift('lid')];layers[1]['idle']=[{'type':'glow','base':.7,'range':.3,'flicker':.15}]
  elif id=='stocking':
   pivot=pt((635,218));sway=[{'type':'sway','deg':3,'pivot':pivot}]
   layers=[layer('hook'),layer('stocking',idle=sway),layer('letter','pop',pivot=pt((530,307)),open=[{'at':0,'y':0,'scaleY':.6},{'at':.8,'y':-.22,'scaleY':1},{'at':1,'y':-.19,'scaleY':1}],idle=sway)]
  elif id=='rice-dumpling':layers=[layer('dumpling'),layer('string','fade',open=[{'at':0,'opacity':1},{'at':.2,'opacity':0},{'at':1,'opacity':0}]),layer('leaf','hinge',pivot=pt((638,270)),open=[{'at':0,'rotate':0,'opacity':1},{'at':.2,'rotate':0,'opacity':1},{'at':1,'rotate':-105,'opacity':.3}])]
  elif id=='wish-tag':layers=[layer('bamboo'),layer('knot','fade',open=[{'at':0,'opacity':1},{'at':.25,'opacity':0},{'at':1,'opacity':0}]),layer('tag','lift',open=[{'at':0,'y':0,'opacity':1},{'at':.25,'y':0,'opacity':1},{'at':1,'y':-.55,'opacity':0}])];idle=[{'type':'sway','deg':3,'pivot':pt((510,1030))}]
  else:
   layers=[layer('water',ground=True),layer('interior'),fade('glow'),layer('lantern'),lift('top')];layers[2]['idle']=[{'type':'glow','base':.7,'range':.3}]
  spec={'id':id,'opening':opening,'idleMs':4000,'idle':idle,'layers':layers,'mouth':pt(mouth),'baseY':900,'sparkle':pt(spark),'glint':None,'openGlow':None,'readyPulse':None}
  assembled=render(native,spec,0);assembled.save(V/f'vessel-{id}.png',optimize=True);spec['baseY']=box(assembled)[3]-1;specs[id]=spec
  prompts[f'vessels/vessel-{id}.png']=cfg[id]['prompt']
  for name in native:prompts[f'vessels/vessel-{id}-{name}.png']=cfg[id]['body_prompt'] if name in ('box','tin','pumpkin','dumpling','bamboo','lantern','letter') else cfg[id]['prompt']
 (C/'b3-specs.json').write_text(json.dumps(specs,indent=2)+'\n');(C/'b3-prompts.json').write_text(json.dumps(prompts,ensure_ascii=False,indent=2)+'\n');print('Prepared',len(specs),'B3 vessels')
if __name__=='__main__':main()
