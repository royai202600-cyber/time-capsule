from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
import json,runpy
A=Path(__file__).resolve().parents[1];S=A/'_checks/b6-sources';V=A/'vessels';C=A/'_checks';F=runpy.run_path(str(A/'scripts/finish-batch1.py'))['frame'];paper=(246,248,251,255)
def clean(im):
 im=im.convert('RGBA');im.putalpha(im.getchannel('A').point(lambda a:a if a>=20 else 0));return im
def fit(im,box):
 im=clean(im);bb=im.getchannel('A').getbbox();crop=im.crop(bb);crop.thumbnail((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS);o=Image.new('RGBA',(1254,1254));o.alpha_composite(crop,(round((box[0]+box[2]-crop.width)/2),box[3]-crop.height));return o
def glass(im):
 rgba=bytearray(im.tobytes())
 for i in range(0,len(rgba),4):
  r,g,b,a=rgba[i:i+4]
  if a and b>r+8 and g>r+4 and r>110:rgba[i+3]=round(a*.375)
 return Image.frombytes('RGBA',im.size,bytes(rgba))
for id in ['potion','memorial-candle','diploma-tube']:
 closed=clean(Image.open(S/f'{id}-closed.png'));reveal=clean(Image.open(S/f'{id}-reveal.png'))
 box={'potion':(495,275,760,455),'memorial-candle':(292,330,935,600),'diploma-tube':(450,270,800,410)}[id];mask=Image.new('L',closed.size);ImageDraw.Draw(mask).rounded_rectangle(box,radius=40,fill=255);mask=mask.filter(ImageFilter.GaussianBlur(2));cap=Image.new('RGBA',closed.size);cap.paste(closed,(0,0),mask)
 if id=='potion':
  base=fit(Image.open(S/'potion-no-bubbles.png'),(316,283,929,1152));body=Image.composite(reveal,base,mask);body=glass(body);particle=fit(Image.open(S/'potion-bubbles.png'),(450,735,790,1060)); alpha=particle.getchannel('A').filter(ImageFilter.GaussianBlur(2)); particle=Image.new('RGBA',closed.size,(243,226,187,0)); particle.putalpha(alpha);other=[('flask',body),('bubbles',particle)];idle=[{'type':'bob','amount':.025}];code='D';part='cork'
 elif id=='memorial-candle':
  body=glass(Image.composite(reveal,closed,mask));gl=Image.new('RGBA',closed.size,(243,226,187,0));alpha=Image.new('L',closed.size);ImageDraw.Draw(alpha).ellipse((425,555,820,910),fill=210);alpha=alpha.filter(ImageFilter.GaussianBlur(55));gl.putalpha(alpha);other=[('glow',gl),('jar',body)];idle=[{'type':'breathe','amount':.025}];code='C';part='lid'
 else:
  empty=clean(Image.open(S/'diploma-tube-empty.png'));body=Image.composite(empty,closed,mask);roll=fit(Image.open(S/'diploma-tube-diploma.png'),(490,260,760,800));other=[('tube',body),('diploma',roll)];idle=[{'type':'bob','amount':.025}];code='D';part='cap'
 bb=closed.getchannel('A').point(lambda a:255 if a>20 else 0).getbbox();l,t,rr,b=bb;scale=min(1,700/(rr-l),740/(b-t));dx=512-(l+rr)*scale/2;dy=900-b*scale
 def norm(im):
  o=Image.new('RGBA',(1024,1024));o.alpha_composite(im.resize((round(1254*scale),round(1254*scale)),Image.Resampling.LANCZOS),(round(dx),round(dy)));return o
 def pt(x,y):return {'x':round(x*scale+dx),'y':round(y*scale+dy)}
 parts={n:norm(im) for n,im in other+[(part,cap)]};layers=[]
 for n,_ in other:
  layer={'name':n,'file':f'vessel-{id}-{n}.png','role':'static'}
  if n=='bubbles':layer.update(role='fade',open=[{'at':0,'opacity':1},{'at':1,'opacity':0}],idle=[{'type':'drift','amount':.03}])
  if n=='glow':layer.update(role='fade',open=[{'at':0,'opacity':1},{'at':1,'opacity':1}],idle=[{'type':'glow','base':.8,'range':.2,'flicker':.1}])
  if n=='diploma':layer.update(role='slide',open=[{'at':0,'opacity':0,'y':.15},{'at':.35,'opacity':0,'y':.15},{'at':1,'opacity':1,'y':-.08}])
  layers.append(layer)
 pivot=pt(box[0],box[1]);layers.append({'name':part,'file':f'vessel-{id}-{part}.png','role':'lift' if id=='memorial-candle' else 'hinge','pivot':pivot,'open':[{'at':0,'opacity':1},{'at':1,'y':-.36,'rotate':-10 if id!='memorial-candle' else 0,'opacity':0}]})
 spec={'id':id,'opening':code,'idleMs':4000,'idle':idle,'layers':layers,'mouth':pt((box[0]+box[2])/2,box[3]),'baseY':0,'sparkle':pt(*{'potion':(550,445),'memorial-candle':(380,540),'diploma-tube':(550,310)}[id]),'glint':None,'openGlow':None,'readyPulse':None}
 assembled=F(parts,spec,0);bb=assembled.getchannel('A').point(lambda a:255 if a>20 else 0).getbbox();spec['baseY']=bb[3]-1;assert bb[1]>=100 and bb[2]-bb[0]<=760 and 880<=spec['baseY']<=920,(id,bb)
 for n,im in parts.items():im.save(V/f'vessel-{id}-{n}.png')
 assembled.save(V/f'vessel-{id}.png');(C/f'{id}-vessel.json').write_text(json.dumps(spec,indent=2)+'\n')
 sheet=Image.new('RGB',(1320,550),paper[:3]);d=ImageDraw.Draw(sheet)
 for i,t in enumerate([0,.5,1]):
  im=F(parts,spec,t);bg=Image.new('RGBA',im.size,paper);bg.alpha_composite(im);sheet.paste(bg.convert('RGB').resize((440,440)),(i*440,40));d.text((i*440+10,10),['CLOSED','HALF','OPEN'][i],fill=(22,38,63))
  for p,label,col in [(pivot,'pivot',(163,54,79)),(spec['mouth'],'mouth',(22,38,63)),(spec['sparkle'],'sparkle',(201,161,90))]:
   x=i*440+round(p['x']*440/1024);y=40+round(p['y']*440/1024);d.line((x-6,y,x+6,y),fill=col,width=2);d.line((x,y-6,x,y+6),fill=col,width=2);d.text((x+7,y),label,fill=col)
 sheet.save(C/f'{id}-motion.png');small=Image.new('RGB',(240,140),paper[:3]);bg=Image.new('RGBA',assembled.size,paper);bg.alpha_composite(assembled);small.paste(bg.convert('RGB').resize((40,40)),(30,50));small.paste(bg.convert('RGB').resize((120,120)),(100,10));small.save(C/f'{id}-silhouette.png');print(id,bb,'closed exact',assembled.tobytes()==F(parts,spec,0).tobytes())
