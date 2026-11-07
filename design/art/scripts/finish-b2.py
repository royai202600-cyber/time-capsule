#!/usr/bin/env python3
"""Register generated B2 parts, measure motion, and render SOP review sheets."""
import json, math, runpy
from pathlib import Path
from PIL import Image,ImageDraw,ImageChops,ImageFilter,ImageFont
R=Path(__file__).resolve().parents[1]; C=R/'_checks'; V=R/'vessels'
FRAME=runpy.run_path(str(R/'scripts/finish-batch1.py'))['frame']; PAPER=(246,248,251,255)
IDS=['clock-tower','senado-fountain','bamboo-tower','gate-lantern','torii-scroll','palace-pavilion','lionfish-fountain','golden-roof','gate-lacquer','twin-towers']
def clean(im):
 im=im.convert('RGBA');im.putalpha(im.getchannel('A').point(lambda a:a if a>=16 else 0));return im

def box(im):return im.getchannel('A').point(lambda a:255 if a>25 else 0).getbbox()
def cut(im,m):
 out=im.copy();out.putalpha(ImageChops.multiply(im.getchannel('A'),m));return out

def polygon(points,size=(1254,1254)):
 m=Image.new('L',size);ImageDraw.Draw(m).polygon(points,fill=255);return m

def above(points):return polygon([(0,0),(1253,0),(1253,points[-1][1])]+list(reversed(points))+[(0,points[0][1])])
def fitted(im,target):
 crop=im.crop(box(im));assert crop.width>=target[2]-target[0] and crop.height>=target[3]-target[1],(crop.size,target)
 out=Image.new('RGBA',im.size);out.alpha_composite(crop.resize((target[2]-target[0],target[3]-target[1]),Image.Resampling.LANCZOS),target[:2]);return out

def softspot(size,center,radii,color=(243,226,187),alpha=210):
 out=Image.new('RGBA',size);d=ImageDraw.Draw(out);x,y=center;rx,ry=radii;d.ellipse((x-rx,y-ry,x+rx,y+ry),fill=(*color,alpha));return out.filter(ImageFilter.GaussianBlur(min(rx,ry)*.35))

def font(n):return ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',n)
def flatten(im):return Image.alpha_composite(Image.new('RGBA',im.size,PAPER),im).convert('RGB')

def make(id,orig,opened):
 size=orig.size;assert size==(1254,1254)
 if id=='clock-tower':
  m=Image.new('L',size);d=ImageDraw.Draw(m);d.rounded_rectangle((518,410,676,560),radius=8,fill=255);d.rectangle((514,429,535,550),fill=255);d.rounded_rectangle((651,473,689,503),radius=5,fill=255)
  body=Image.composite(opened,orig,m)
  erase=Image.new('L',size);d=ImageDraw.Draw(erase);d.line(((551,463),(595,489)),fill=255,width=17);d.line(((595,489),(648,448)),fill=255,width=17);d.ellipse((581,474,609,503),fill=255);erase=erase.filter(ImageFilter.MaxFilter(5))
  hm=erase.copy();p=orig.load();mp=hm.load()
  for y in range(420,530):
   for x in range(535,660):
    r,g,b,a=p[x,y]
    if not(r<245 and g<215 and b<182):mp[x,y]=0
  hm=hm.filter(ImageFilter.MaxFilter(3));hands=cut(orig,hm)
  tex=Image.open(C/'t10b-clock-blank-door-source.png').convert('RGBA').crop((350,350,900,850)).resize((158,150))
  fill=orig.copy();fill.alpha_composite(tex,(518,410));door=cut(Image.composite(fill,orig,erase.filter(ImageFilter.GaussianBlur(.6))),m)
  parts={'tower':body,'door':door,'hands':hands};anchor=(525,486);mouth=(594,450);spark=(675,489)
 elif id=='torii-scroll':
  pts=[(363,890),(385,866),(418,852),(532,852),(532,830),(540,811),(560,807),(590,816),(620,840),(642,819),(671,806),(692,807),(707,822),(708,843),(697,853),(785,843),(814,855),(835,877),(846,905),(845,940),(824,967),(790,981),(443,994),(410,983),(378,970),(363,944)]
  m=polygon(pts);removal=polygon([(350,800),(855,800),(855,1000),(350,1000)]);parts={'gate':Image.composite(opened,orig,removal),'scroll':cut(orig,m)};anchor=(612,922);mouth=(610,900);spark=(410,922)
 else:
  if id=='senado-fountain':pts=[(0,626),(217,637),(313,700),(470,731),(650,742),(850,724),(1004,675),(1050,620),(1253,620)];name='lid';bodyname='box';anchor=(620,650);mouth=(620,600);spark=(650,490)
  elif id=='bamboo-tower':
   pts=[(0,641),(490,641),(510,659),(700,666),(745,644),(1253,644)];name='top';bodyname='tin';anchor=(620,650);mouth=(620,647);spark=(510,650);opened=fitted(opened,(490,635,752,1159))
  elif id=='gate-lantern':pts=[(0,329),(432,329),(475,350),(620,365),(760,353),(820,333),(1253,333)];name='cap';bodyname='lantern';anchor=(625,330);mouth=(620,320);spark=(615,225)
  elif id=='palace-pavilion':pts=[(0,667),(155,681),(250,733),(430,758),(750,767),(850,754),(1030,715),(1153,644),(1253,644)];name='roof';bodyname='base';anchor=(620,730);mouth=(620,660);spark=(1129,535)
  elif id=='golden-roof':pts=[(0,834),(255,871),(816,899),(1004,868),(1070,827),(1253,827)];name='roof';bodyname='box';anchor=(620,850);mouth=(620,800);spark=(842,696)
  elif id=='gate-lacquer':pts=[(0,586),(224,637),(800,647),(1006,618),(1105,588),(1253,588)];name='roof';bodyname='box';anchor=(620,626);mouth=(620,566);spark=(480,744)
  elif id=='twin-towers':pts=[(0,478),(1253,478)];name='tops';bodyname='towers';anchor=(620,470);mouth=(474,462);spark=(600,846)
  elif id=='lionfish-fountain':
   pts=[(0,0),(0,0)] # stopper mask is local, excluding the detached droplets
   m=polygon([(475,130),(770,130),(770,400),(740,457),(500,457),(475,400)])
   spraymask=polygon([(748,325),(910,325),(910,510),(748,510)])
   body=Image.composite(opened,orig,ImageChops.lighter(m,spraymask));stopper=cut(orig,m)
   # Clear only pale blue glass fill, preserving letter, brass, outline and white glints.
   p=body.load()
   for y in range(380,1120):
    for x in range(280,950):
     r,g,b,a=p[x,y]
     if a and b>r+3 and b>=g and r>120 and not(min(r,g,b)>235):p[x,y]=(r,g,b,round(a*.375))
   spray=Image.new('RGBA',size)
   positions=[(754,348),(791,371),(832,390),(871,418),(778,421),(815,456),(850,487),(733,398),(899,450),(786,491),(861,352),(916,397),(746,462),(809,330)]
   for i,(x,y) in enumerate(positions):
    rad=4+i%4;spot=softspot(size,(x,y),(rad,rad+3),(90,143,208),220);spray=Image.alpha_composite(spray,spot)
   parts={'bottle':body,'spray':spray,'stopper':stopper};anchor=(620,435);mouth=(620,416);spark=(420,710)
  if id!='lionfish-fountain':
   m=above(pts);parts={bodyname:Image.composite(opened,orig,m),name:cut(orig,m)}
   if id=='gate-lantern':
    glow=softspot(size,(620,1104),(95,35),(243,226,187),230)
    # The glow sits behind the paper; a translucent window over the existing
    # dark lower band gives it contrast without drifting any solid artwork.
    a=parts['lantern'].getchannel('A');g=glow.getchannel('A').point(lambda v:round(v*.45));parts['lantern'].putalpha(ImageChops.subtract(a,g));parts={'glow':glow,**parts}
   if id=='twin-towers':
    glow=softspot(size,(600,869),(40,13),(243,226,187),240);parts={'towers':parts['towers'],'glow':glow,'tops':parts['tops']}
 return parts,anchor,mouth,spark

def spec_for(id,P,anchor,mouth,spark,base):
 static=lambda n:{'name':n,'file':f'vessel-{id}-{n}.png','role':'static'}
 lift=lambda n:{**static(n),'role':'lift','pivot':P(*anchor),'open':[{'at':0,'y':0,'opacity':1},{'at':.65,'y':-.4,'opacity':.65},{'at':1,'y':-.65,'opacity':0}]}
 idle=[];layers=[]
 if id=='clock-tower':
  center=P(595,489);layers=[static('tower'),{**static('door'),'role':'door','pivot':P(*anchor),'open':[{'at':0,'scaleX':1},{'at':.3,'scaleX':1},{'at':1,'scaleX':.04}]},{**static('hands'),'role':'fade','pivot':center,'open':[{'at':0,'opacity':1},{'at':.3,'opacity':0},{'at':1,'opacity':0}],'idle':[{'type':'tick','deg':6,'pivot':center}]}];idle=[{'type':'breathe','amount':.025}];code='J'
 elif id=='torii-scroll':layers=[static('gate'),{**static('scroll'),'role':'slide','open':[{'at':0,'x':0,'y':0,'scale':1},{'at':1,'x':.025,'y':-.36,'scale':1.08}]}];idle=[{'type':'bob','amount':.025}];code='F'
 elif id=='lionfish-fountain':
  layers=[static('bottle'),{**static('spray'),'role':'fade','open':[{'at':0,'opacity':1},{'at':1,'y':-.16,'opacity':0}],'idle':[{'type':'drift','amount':.03}]},{**static('stopper'),'role':'hinge','pivot':P(*anchor),'open':[{'at':0,'y':0,'rotate':0,'opacity':1},{'at':.35,'y':-.12,'rotate':-12,'opacity':1},{'at':1,'x':.17,'y':-.3,'rotate':-25,'opacity':0}]}];idle=[{'type':'bob','amount':.025}];code='D'
 else:
  data={'senado-fountain':('box','lid','B'),'bamboo-tower':('tin','top','C'),'gate-lantern':('lantern','cap','C'),'palace-pavilion':('base','roof','B'),'golden-roof':('box','roof','B'),'gate-lacquer':('box','roof','B'),'twin-towers':('towers','tops','C')};body,cover,code=data[id];layers=[static(body),lift(cover)]
  if id=='bamboo-tower':idle=[{'type':'sway','deg':2.5,'pivot':P(620,1156)}]
  elif id=='gate-lantern':
   layers.insert(0,{**static('glow'),'role':'fade','open':[{'at':0,'opacity':1},{'at':1,'opacity':0}],'idle':[{'type':'glow','base':.35,'range':.65}]});idle=[{'type':'sway','deg':3,'pivot':P(625,165)}]
  elif id=='twin-towers':
   layers.insert(1,{**static('glow'),'role':'fade','open':[{'at':0,'opacity':1},{'at':1,'opacity':0}],'idle':[{'type':'glow','base':.25,'range':.75}]});idle=[{'type':'breathe','amount':.025}]
   layers[-1]['open']=[{'at':0,'y':0,'opacity':1},{'at':.5,'y':-.1,'opacity':.65},{'at':1,'y':-.32,'opacity':0}]
  else:idle=[{'type':'breathe','amount':.025}]
 return {'id':id,'opening':code,'idleMs':4200 if id=='clock-tower' else 4000,'idle':idle,'layers':layers,'mouth':P(*mouth),'baseY':base,'sparkle':P(*spark),'glint':None,'openGlow':None,'readyPulse':None}

def review(id,parts,spec,assembled):
 sheet=Image.new('RGB',(1240,650),PAPER[:3]);d=ImageDraw.Draw(sheet)
 for i,t in enumerate((0,.5,1)):
  x=15+i*410;sheet.paste(flatten(FRAME(parts,spec,t)).resize((400,400),Image.Resampling.LANCZOS),(x,40));d.text((x+10,10),['CLOSED','HALF OPEN','OPEN'][i],fill='#16263F',font=font(20))
  marks=[('mouth',spec['mouth'],'#A3364F'),('sparkle',spec['sparkle'],'#C9A15A')]+[(l['name'],l['pivot'],'#6E2B3F') for l in spec['layers'] if 'pivot'in l]
  for _,p,c in marks:
   px=x+round(p['x']*400/1024);py=40+round(p['y']*400/1024);d.line((px-5,py,px+5,py),fill=c,width=2);d.line((px,py-5,px,py+5),fill=c,width=2)
 d.text((20,453),f"{id} | {spec['opening']} | baseY {spec['baseY']} | mouth {spec['mouth']} | sparkle {spec['sparkle']}",fill='#16263F',font=font(16))
 y=483
 for l in spec['layers']:
  if l.get('open'):
   line=l['name']+' '+l['role']+' pivot '+str(l.get('pivot'))+' keys '+json.dumps(l['open'],separators=(',',':'))
   for start in range(0,len(line),140):d.text((20,y),line[start:start+140],fill='#16263F',font=font(13));y+=18
 footer='Crosshairs: plum = pivots; red = mouth; brass = sparkle. Hands tick 6 degrees; never spin.'
 if id=='twin-towers':footer='Crosshairs: plum = top lift pivot; red = mouth; brass = sparkle. Idle: breathe 0.025 + bridge glow pulse.'
 d.text((20,620),footer,fill='#16263F',font=font(14))
 sheet.save(C/f'{id}-motion.png',optimize=True)
 sizes=Image.new('RGB',(300,175),PAPER[:3]);sd=ImageDraw.Draw(sizes)
 for n,x in ((40,25),(120,130)):
  flat=flatten(assembled.resize((n,n),Image.Resampling.LANCZOS));sizes.paste(flat,(x,15));sd.text((x,145),f'{n} px',fill='#16263F',font=font(16));flat.save(C/f'{id}-at-{n}px.png')
 sizes.save(C/f'{id}-silhouette.png',optimize=True);assembled.save(C/f'{id}-stack.png',optimize=True)

def main():
 gen=json.loads((C/'t10b-generation.json').read_text());prompts={};reports={}
 for id in IDS:
  orig=clean(Image.open(C/f't10b-{id}-assembled-source.png'));opened=clean(Image.open(C/f't10b-{id}-open-source.png'))
  parts,anchor,mouth,spark=make(id,orig,opened);b=box(orig);s=min(1024/1254,740/(b[2]-b[0]),780/(b[3]-b[1]));dx=512-(b[0]+b[2])*s/2;dy=900-b[3]*s
  P=lambda x,y:{'x':round(x*s+dx),'y':round(y*s+dy)}
  normalized={}
  for n,im in parts.items():
   out=Image.new('RGBA',(1024,1024));out.alpha_composite(im.resize((round(1254*s),round(1254*s)),Image.Resampling.LANCZOS),(round(dx),round(dy)));normalized[n]=clean(out)
  parts=normalized;spec=spec_for(id,P,anchor,mouth,spark,900);assembled=FRAME(parts,spec,0);bbox=box(assembled);spec['baseY']=bbox[3]-1
  assert bbox[1]>=100 and 880<=spec['baseY']<=920 and bbox[2]-bbox[0]<=760,(id,bbox)
  for n,im in parts.items():
   im.save(V/f'vessel-{id}-{n}.png',optimize=True)
   prompts[f'vessels/vessel-{id}-{n}.png']=gen[id]['body']['prompt'] if n in ('tower','box','base','tin','gate','bottle','towers','lantern') else gen[id]['prompt']+'\n\nRegistered isolation/soft-effect refinement from this assembled master by finish-b2.py; same canvas and common transform.'
  assembled.save(V/f'vessel-{id}.png',optimize=True);prompts[f'vessels/vessel-{id}.png']=gen[id]['prompt']
  (C/f't10b-{id}-spec.json').write_text(json.dumps(spec,indent=2)+'\n')
  assert ImageChops.difference(assembled,FRAME(parts,spec,0)).getbbox() is None
  assert assembled.getpixel((spec['sparkle']['x'],spec['sparkle']['y']))[3]>20,(id,'sparkle must touch artwork')
  corners=[im.getpixel(p)[3] for im in [assembled,*parts.values()] for p in ((0,0),(1023,0),(0,1023),(1023,1023))];assert not any(corners)
  review(id,parts,spec,assembled)
  reports[id]={'canvas':[1024,1024],'visible_bbox':bbox,'baseY':spec['baseY'],'rest_stack_exact':True,'corners_alpha_zero':True,'native_to_master':{'scale':s,'dx':round(dx),'dy':round(dy)},'ip_sensitivity':'Original souvenir interpretation, no logos, writing, emblems or sacred figures; trademarked forms kept loose.','silhouette_review':'120 px review required before shipment'}
  (C/f'{id}-check.json').write_text(json.dumps(reports[id],indent=2)+'\n')
 (C/'t10b-batch-prompts.json').write_text(json.dumps(prompts,ensure_ascii=False,indent=2)+'\n');(C/'t10b-validation.json').write_text(json.dumps(reports,indent=2)+'\n');print('Prepared and checked',len(reports),'B2 vessels')
if __name__=='__main__':main()
