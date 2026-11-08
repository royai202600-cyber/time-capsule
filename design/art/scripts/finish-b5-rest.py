#!/usr/bin/env python3
"""Fit B5 generated edits, normalize each shared canvas and make review sheets."""
import json, runpy, math, subprocess, sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont
R=Path(__file__).resolve().parents[1]; C=R/'_checks'; V=R/'vessels'; PAPER=(246,248,251,255)
F=runpy.run_path(str(R/'scripts/finish-batch1.py')); FRAME=F['frame']; EXP=runpy.run_path(str(R/'scripts/check-batch1.py'))['expanded']
font=lambda n:ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',n)
def load(n): return Image.open(C/('b5-'+n+'.png')).convert('RGBA')
def box(im):return im.getchannel('A').point(lambda a:255 if a>25 else 0).getbbox()
def clean(im):
 im=im.convert('RGBA');im.putalpha(im.getchannel('A').point(lambda a:a if a>=8 else 0));return im
def fit(im,b):
 im=clean(im);cut=im.crop(box(im));w,h=b[2]-b[0],b[3]-b[1]
 assert w<=cut.width and h<=cut.height,(cut.size,b)
 cut=cut.resize((w,h),Image.Resampling.LANCZOS);o=Image.new('RGBA',(1254,1254));o.alpha_composite(cut,b[:2]);return o
def glass(n,target):
 im=fit(load(n),target); data=bytearray(im.tobytes())
 for i in range(0,len(data),4):
  r,g,b,a=data[i:i+4]
  if a and b>=r and b>g and r>140 and b>180 and not(r>228 and g>230 and b>230):data[i+3]=min(a,192)
 im=Image.frombytes('RGBA',im.size,bytes(data));src=C/('b5-'+n+'-marked.tmp.png');dst=C/('b5-'+n+'-adjusted.tmp.png');im.save(src)
 subprocess.run([sys.executable,str(R/'scripts/adjust-glass-alpha.py'),str(src),str(dst),'0.5'],check=True)
 result=Image.open(dst).convert('RGBA');src.unlink();dst.unlink();return result
def normalize(im,s,dx,dy):
 z=im.resize((round(1254*s),round(1254*s)),Image.Resampling.LANCZOS);o=Image.new('RGBA',(1024,1024));o.alpha_composite(z,(round(dx),round(dy)));return clean(o)
def flat(im):return Image.alpha_composite(Image.new('RGBA',im.size,PAPER),im).convert('RGB')
def li(id,name,role='static',**kw):return {'name':name,'file':f'vessel-{id}-{name}.png','role':role,**kw}
def blend(parts):
 o=Image.new('RGBA',(1254,1254))
 for p in parts:o=Image.alpha_composite(o,p)
 return o
def native(id):
 if id=='bubble-tea':
  cup=blend([fit(load('bubble-contents'),(367,415,870,1105)),glass('bubble-glass',(327,338,921,1138))]);lid=fit(load('bubble-film-part'),(327,44,921,689));return {'cup':cup,'lid':lid}
 if id=='dim-sum-steamer':
  steam=fit(load('dim-sum-steam'),(230,170,995,520));a=steam.getchannel('A').filter(ImageFilter.GaussianBlur(5)).point(lambda x:round(x*.48));steam=Image.new('RGBA',steam.size,(220,232,242,0));steam.putalpha(a)
  return {'steamer':load('dim-sum-steamer-reveal'),'steam':steam,'lid':fit(load('dim-sum-steamer-cover'),(235,340,995,780))}
 if id=='bento':return {'box':load('bento-food-reveal'),'lid':fit(load('bento-cover'),(160,530,1075,919)),'knot':fit(load('bento-knot'),(355,450,880,1110))}
 if id=='paper-cranes':
  jar=blend([fit(load('cranes-contents'),(320,472,920,1050)),glass('cranes-glass',(292,308,953,1100))]);return {'jar':jar,'lid':fit(load('paper-cranes-cover'),(370,235,878,445))}
 if id=='heart-locket':
  back=load('heart-locket-reveal');mask=Image.new('L',back.size)
  ImageDraw.Draw(mask).polygon([(0,0),(1254,0),(1254,250),(640,250),(600,370),(475,450),(475,920),(1254,920),(1254,1254),(0,1254)],fill=255)
  blank=Image.new('RGBA',back.size)
  return {'stand':Image.composite(back,blank,mask),'back':Image.composite(blank,back,mask),'front':fit(load('heart-locket-cover'),(500,433,935,920))}
 if id=='suitcase':return {'case':load('suitcase-reveal'),'lid':fit(load('suitcase-cover'),(120,365,1124,830))}
 if id=='postbox':return {'box':load('postbox-reveal'),'door':fit(load('postbox-cover'),(445,565,810,956))}
 if id=='treasure-chest':return {'chest':load('treasure-chest-reveal'),'lid':fit(load('treasure-chest-cover'),(180,305,1055,710))}
 if id=='camp-lantern':
  # A still navy backing keeps contrast while only the soft halo flickers.
  # The generated flame core and all metal remain fully visible in lantern.
  lantern=blend([load('lantern-body'),glass('lantern-glass',(400,475,835,900))])
  # An intact still copy underneath the inner window keeps every flame/core
  # pixel present. The translucent upper window admits only the soft halo.
  backing=Image.new('RGBA',lantern.size);backing.paste(lantern.crop((465,490,770,880)),(465,490))
  window=Image.new('L',lantern.size);ImageDraw.Draw(window).ellipse((495,535,740,845),fill=165)
  window=window.filter(ImageFilter.GaussianBlur(10));data=bytearray(lantern.tobytes());weights=window.tobytes()
  for i,w in enumerate(weights):
   if w:data[4*i+3]=round(data[4*i+3]*(1-w/255))
  lantern=Image.frombytes('RGBA',lantern.size,bytes(data))
  halo=Image.new('L',lantern.size);ImageDraw.Draw(halo).ellipse((535,570,705,825),fill=150)
  halo=halo.filter(ImageFilter.GaussianBlur(35));glow=Image.new('RGBA',lantern.size,(201,161,90,0));glow.putalpha(halo)
  return {'backing':backing,'glow':glow,'lantern':lantern,'cap':fit(load('camp-lantern-cover'),(430,208,810,485))}
 raise KeyError(id)
def spec_for(id,point,base):
 P=lambda x,y:dict(zip(('x','y'),point(x,y)))
 lift=lambda n,p:{**li(id,n,'lift',pivot=P(*p),open=[{'at':0,'y':0,'opacity':1},{'at':1,'y':-.45,'opacity':0}])}
 hinge=lambda n,p:{**li(id,n,'hinge',pivot=P(*p),open=[{'at':0,'rotate':0,'opacity':1},{'at':.5,'rotate':-30,'opacity':.8},{'at':1,'rotate':-65,'opacity':0}])}
 door=lambda n,p:{**li(id,n,'hinge',pivot=P(*p),open=[{'at':0,'scaleX':1},{'at':1,'scaleX':.03}])}
 s={'id':id,'opening':'B','idleMs':4000,'idle':[],'layers':[],'mouth':P(625,650),'baseY':base,'sparkle':P(625,600),'glint':None,'openGlow':None,'readyPulse':None}
 if id=='bubble-tea':s.update(opening='C',idle=[{'type':'bob','amount':.025}],layers=[li(id,'cup'),lift('lid',(625,420))],mouth=P(625,425),sparkle=P(355,520))
 if id=='dim-sum-steamer':
  steam=li(id,'steam','fade',open=[{'at':0,'opacity':1},{'at':1,'opacity':0}],idle=[{'type':'drift','amount':.03}]);s.update(idle=[{'type':'breathe','amount':.025}],layers=[li(id,'steamer'),steam,lift('lid',(625,620))],mouth=P(625,570),sparkle=P(810,730))
 if id=='bento':
  knot=li(id,'knot','fade',open=[{'at':0,'opacity':1},{'at':.35,'opacity':0},{'at':1,'opacity':0}]);lid=lift('lid',(625,670));lid['open']=[{'at':0,'y':0,'opacity':1},{'at':.35,'y':0,'opacity':1},{'at':1,'y':-.48,'opacity':0}];s.update(idle=[{'type':'breathe','amount':.025}],layers=[li(id,'box'),lid,knot],mouth=P(625,675),sparkle=P(990,870))
 if id=='paper-cranes':
  lid=li(id,'lid','twist',pivot=P(625,400),open=[{'at':0,'rotate':0,'y':0,'opacity':1},{'at':.3,'rotate':-12,'y':0,'opacity':1},{'at':1,'rotate':-12,'y':-.4,'opacity':0}]);s.update(opening='G',idle=[{'type':'breathe','amount':.025}],layers=[li(id,'jar'),lid],mouth=P(625,390),sparkle=P(340,520),glint=f'vessel-{id}-glint.png')
 if id=='heart-locket':
  sway=[{'type':'sway','deg':4,'pivot':P(720,250)}];back=li(id,'back',idle=sway);front=door('front',(500,700));front['idle']=sway
  s.update(opening='J',layers=[li(id,'stand'),back,front],mouth=P(720,580),sparkle=P(405,270))
 if id=='suitcase':s.update(opening='A',idle=[{'type':'bob','amount':.025}],layers=[li(id,'case'),hinge('lid',(630,430))],mouth=P(630,590),sparkle=P(1020,495))
 if id=='postbox':s.update(opening='J',idle=[{'type':'breathe','amount':.025}],layers=[li(id,'box'),door('door',(800,750))],mouth=P(620,490),sparkle=P(460,465))
 if id=='camp-lantern':
  glow=li(id,'glow','fade',open=[{'at':0,'opacity':1},{'at':1,'opacity':1}],idle=[{'type':'glow','base':.65,'range':.3,'flicker':.06}]);s.update(opening='C',layers=[li(id,'backing'),glow,li(id,'lantern'),lift('cap',(625,400))],mouth=P(625,475),sparkle=P(430,870))
 if id=='treasure-chest':s.update(opening='A',idle=[{'type':'breathe','amount':.025}],layers=[li(id,'chest'),hinge('lid',(625,445))],mouth=P(625,550),sparkle=P(745,625))
 return s
def main():
 ids=['bubble-tea','dim-sum-steamer','bento','paper-cranes','heart-locket','suitcase','postbox','camp-lantern','treasure-chest'];specs={};reports={}
 for id in ids:
  parts=native(id); resting=blend(list(parts.values())); b=box(resting);s=min(1024/1254,755/(b[2]-b[0]),775/(b[3]-b[1]));dx=512-(b[0]+b[2])*s/2;dy=900-b[3]*s;point=lambda x,y:(round(dx+x*s),round(dy+y*s))
  parts={n:normalize(p,s,dx,dy) for n,p in parts.items()};stack=Image.new('RGBA',(1024,1024))
  for p in parts.values():stack=Image.alpha_composite(stack,p)
  b=box(stack);spec=spec_for(id,point,b[3]-1);specs[id]=spec
  # Assembly comes from precisely the same ordered layers and resting keyframes.
  assembled=FRAME(parts,spec,0);assembled.save(V/f'vessel-{id}.png',optimize=True)
  for name,im in parts.items():im.save(V/f'vessel-{id}-{name}.png',optimize=True)
  if id=='paper-cranes':
   jar=parts['jar'];gl=Image.new('RGBA',jar.size);pix=jar.load();op=gl.load()
   for y in range(1024):
    for x in range(1024):
     r,g,b,a=pix[x,y]
     if a and r>235 and g>235 and b>235:op[x,y]=(246,248,251,round(a*.45))
   gl=gl.filter(ImageFilter.GaussianBlur(1.5));gl.save(V/f'vessel-{id}-glint.png',optimize=True)
  bounds=box(assembled);assert bounds[2]-bounds[0]<=760 and bounds[1]>=100 and 880<=bounds[3]-1<=920,(id,bounds)
  corners=all(im.getchannel('A').getpixel(pt)==0 for im in [assembled,*parts.values()] for pt in [(0,0),(1023,0),(0,1023),(1023,1023)]);assert corners
  exact=all(ImageChops.difference(assembled,FRAME(parts,spec,0)).getchannel(c).getbbox() is None for c in 'RGBA');assert exact
  FRAME(parts,spec,0).save(C/f'{id}-stack.png',optimize=True)
  strip=Image.new('RGB',(360,180),PAPER[:3]);d=ImageDraw.Draw(strip)
  for n,x in [(40,40),(120,180)]:
   v=flat(assembled).resize((n,n),Image.Resampling.LANCZOS);v.save(C/f'{id}-at-{n}px.png');strip.paste(v,(x,10));d.text((x,145),f'{n} px',font=font(16),fill='#16263F')
  strip.save(C/f'{id}-silhouette.png',optimize=True)
  sheet=Image.new('RGB',(1240,720),PAPER[:3]);d=ImageDraw.Draw(sheet)
  for i,t in enumerate([0,.5,1]):
   x=15+i*410;frame=flat(EXP(parts,spec,t)).resize((400,400),Image.Resampling.LANCZOS);sheet.paste(frame,(x,40));d.text((x+10,10),['CLOSED','HALF OPEN','OPEN'][i],font=font(20),fill='#16263F')
   for p,color in [(spec['mouth'],'#A3364F'),(spec['sparkle'],'#C9A15A')]+[(l['pivot'],'#6E2B3F') for l in spec['layers'] if 'pivot'in l]:
    px=x+round((p['x']+256)*400/1536);py=40+round((p['y']+256)*400/1536);d.line((px-5,py,px+5,py),fill=color,width=2);d.line((px,py-5,px,py+5),fill=color,width=2)
  d.text((20,455),f'{id} | {spec["opening"]} | baseY {spec["baseY"]} | mouth {spec["mouth"]} | sparkle {spec["sparkle"]}',font=font(15),fill='#16263F');y=480
  for l in spec['layers']:
   if 'open' in l:
    text=l['name']+' '+json.dumps(l['open'],separators=(',',':'))
    for j in range(0,len(text),125):d.text((20,y),text[j:j+125],font=font(13),fill='#16263F');y+=20
  d.text((20,690),'Plum: pivot; wax red: mouth; brass: sparkle. Keyframe offsets are fractions of 1024.',font=font(14),fill='#16263F');sheet.save(C/f'{id}-motion.png',optimize=True)
  reports[id]={'bbox':bounds,'corners':corners,'closed_stack_exact':exact,'ip':'Original generic design; no text, logo, character or brand shape.'}
  print(id,bounds,'mechanical checks pass')
 (C/'b5-rest-specs.json').write_text(json.dumps(specs,indent=2)+'\n');(C/'b5-rest-validation.json').write_text(json.dumps(reports,indent=2)+'\n')
if __name__=='__main__':main()
