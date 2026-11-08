from pathlib import Path
import json,runpy
from PIL import Image,ImageDraw,ImageFilter
A=Path(__file__).resolve().parents[1];V=A/'vessels';C=A/'_checks';S=C/'b6-sources'
c=Image.open(S/'escape-pod-closed.png').convert('RGBA');r=Image.open(S/'escape-pod-reveal.png').convert('RGBA')
mask=Image.new('L',c.size);ImageDraw.Draw(mask).rounded_rectangle((526,427,946,851),radius=145,fill=255);mask=mask.filter(ImageFilter.GaussianBlur(2))
body=Image.composite(r,c,mask);hatch=Image.new('RGBA',c.size);hatch.paste(c,(0,0),mask)
g=Image.new('L',c.size);ImageDraw.Draw(g).ellipse((350,555,520,735),fill=160);g=g.filter(ImageFilter.GaussianBlur(45));glow=Image.new('RGBA',c.size,(90,143,208,0));glow.putalpha(g)
bbox=c.getchannel('A').point(lambda a:255 if a>20 else 0).getbbox();left,top,right,bottom=bbox;scale=min(1,740/(right-left),780/(bottom-top));dx=512-(left+right)*scale/2;dy=900-bottom*scale
assert top*scale+dy>=100
def norm(im):
 size=(round(im.width*scale),round(im.height*scale));o=Image.new('RGBA',(1024,1024));o.alpha_composite(im.resize(size,Image.Resampling.LANCZOS),(round(dx),round(dy)));return o
def point(x,y):return {'x':round(x*scale+dx),'y':round(y*scale+dy)}
parts={n:norm(im) for n,im in [('pod',body),('glow',glow),('hatch',hatch)]}
spec={'id':'escape-pod','opening':'A','idleMs':4000,'idle':[{'type':'float','amount':0.03}],'layers':[{'name':'pod','file':'vessel-escape-pod-pod.png','role':'static'},{'name':'glow','file':'vessel-escape-pod-glow.png','role':'fade','open':[{'at':0,'opacity':1},{'at':1,'opacity':1}],'idle':[{'type':'glow','base':0.8,'range':0.2}]},{'name':'hatch','file':'vessel-escape-pod-hatch.png','role':'hinge','pivot':point(945,639),'open':[{'at':0,'scaleX':1,'opacity':1},{'at':1,'scaleX':0.05,'opacity':0}]}],'mouth':point(744,614),'baseY':899,'sparkle':point(465,564),'glint':None,'openGlow':None,'readyPulse':None}
frame=runpy.run_path(str(A/'scripts/finish-batch1.py'))['frame'];assembled=frame(parts,spec,0)
for name,im in parts.items(): im.save(V/f'vessel-escape-pod-{name}.png',optimize=True)
assembled.save(V/'vessel-escape-pod.png',optimize=True)
actual=assembled.getchannel('A').point(lambda a:255 if a>20 else 0).getbbox();spec['baseY']=actual[3]-1;assert actual[2]-actual[0]<=760 and actual[1]>=100 and 880<=spec['baseY']<=920
(C/'escape-pod-vessel.json').write_text(json.dumps(spec,indent=2)+'\n')
paper=(246,248,251,255);sheet=Image.new('RGB',(1320,540),paper[:3]);draw=ImageDraw.Draw(sheet)
for i,t in enumerate([0,.5,1]):
 im=frame(parts,spec,t);bg=Image.new('RGBA',im.size,paper);bg.alpha_composite(im);sheet.paste(bg.convert('RGB').resize((440,440)),(440*i,40));draw.text((440*i+10,10),['CLOSED','HALF','OPEN'][i],fill=(22,38,63))
 for p,label,col in [(spec['layers'][2]['pivot'],'pivot',(163,54,79)),(spec['mouth'],'mouth',(22,38,63)),(spec['sparkle'],'sparkle',(201,161,90))]:
  x=440*i+round(p['x']*440/1024);y=40+round(p['y']*440/1024);draw.line((x-6,y,x+6,y),fill=col,width=2);draw.line((x,y-6,x,y+6),fill=col,width=2);draw.text((x+7,y),label,fill=col)
sheet.save(C/'escape-pod-motion.png');bg=Image.new('RGBA',(1024,1024),paper);bg.alpha_composite(assembled);small=Image.new('RGB',(240,140),paper[:3]);small.paste(bg.convert('RGB').resize((40,40)),(30,50));small.paste(bg.convert('RGB').resize((120,120)),(100,10));small.save(C/'escape-pod-silhouette.png')
print('pod bbox',actual,'rest exact',assembled.tobytes()==frame(parts,spec,0).tobytes())
