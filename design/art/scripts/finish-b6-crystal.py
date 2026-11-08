from pathlib import Path
from PIL import Image
import runpy
A=Path(__file__).resolve().parents[1]; S=A/'_checks/b6-sources'
def clean(i):
 i=i.convert('RGBA');i.putalpha(i.getchannel('A').point(lambda a:a if a>=20 else 0));return i
def fit(im,box):
 im=clean(im);bb=im.getchannel('A').getbbox();crop=im.crop(bb);crop.thumbnail((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS);o=Image.new('RGBA',(1254,1254));o.alpha_composite(crop,(round((box[0]+box[2]-crop.width)/2),box[3]-crop.height));return o
stand=fit(Image.open(S/'crystal-ball-reveal.png'),(350,690,900,1058));mist=fit(Image.open(S/'crystal-ball-mist.png'),(400,330,850,710));ball=fit(Image.open(S/'crystal-ball-glass.png'),(343,256,905,819));raw=bytearray(ball.tobytes())
for i in range(0,len(raw),4):
 r,g,b,a=raw[i:i+4]
 if a>0 and b>r+4 and g>r+3 and r>100:raw[i+3]=round(a*.375)
ball=Image.frombytes('RGBA',ball.size,bytes(raw))
s=.9;dx=-50;dy=-52
# source alpha top 256, bottom1058 => destination top 178 bottom900
def norm(im):
 o=Image.new('RGBA',(1024,1024));o.alpha_composite(im.resize((round(1254*s),round(1254*s)),Image.Resampling.LANCZOS),(round(dx),round(dy)));return o
parts={n:norm(im) for n,im in [('stand',stand),('mist',mist),('ball',ball)]}
spec={'layers':[{'name':'stand'},{'name':'mist','open':[{'at':0,'opacity':1},{'at':1,'opacity':0}]},{'name':'ball','open':[{'at':0,'opacity':1},{'at':1,'y':-.45,'opacity':0}]}]}
frame=runpy.run_path(str(A/'scripts/finish-batch1.py'))['frame'];out=Image.new('RGB',(1320,440),(246,248,251))
for i,t in enumerate([0,.5,1]):
 im=frame(parts,spec,t);bg=Image.new('RGBA',im.size,(246,248,251,255));bg.alpha_composite(im);out.paste(bg.convert('RGB').resize((440,440)),(i*440,0))
out.save(A/'_checks/crystal-ball-preview.png')

import json
spec={'id':'crystal-ball','opening':'B','idleMs':4200,'idle':[{'type':'breathe','amount':0.025}],'layers':[{'name':'stand','file':'vessel-crystal-ball-stand.png','role':'static'},{'name':'mist','file':'vessel-crystal-ball-mist.png','role':'fade','open':[{'at':0,'opacity':1},{'at':1,'opacity':0}],'idle':[{'type':'glow','base':0.75,'range':0.25}]},{'name':'ball','file':'vessel-crystal-ball-ball.png','role':'lift','open':[{'at':0,'y':0,'opacity':1},{'at':1,'y':-.45,'opacity':0}]}],'mouth':{'x':512,'y':647},'baseY':899,'sparkle':{'x':283,'y':251},'glint':None,'openGlow':None,'readyPulse':None}
assembled=frame(parts,spec,0);bb=assembled.getchannel('A').point(lambda x:255 if x>20 else 0).getbbox();spec['baseY']=bb[3]-1;assert bb[1]>=100 and bb[2]-bb[0]<=760 and 880<=spec['baseY']<=920
for n,im in parts.items():im.save(A/'vessels'/f'vessel-crystal-ball-{n}.png')
assembled.save(A/'vessels/vessel-crystal-ball.png');(A/'_checks/crystal-ball-vessel.json').write_text(json.dumps(spec,indent=2)+'\n')
print('crystal',bb,'closed exact',assembled.tobytes()==frame(parts,spec,0).tobytes())

from PIL import ImageDraw
sheet=Image.new('RGB',(1320,550),(246,248,251));d=ImageDraw.Draw(sheet)
for j,t in enumerate([0,.5,1]):
 im=frame(parts,spec,t);bg=Image.new('RGBA',im.size,(246,248,251,255));bg.alpha_composite(im);sheet.paste(bg.convert('RGB').resize((440,440)),(j*440,40));d.text((j*440+10,10),['CLOSED','HALF','OPEN'][j],fill=(22,38,63))
 for point,label,col in [(spec['mouth'],'mouth',(22,38,63)),(spec['sparkle'],'sparkle',(201,161,90))]:
  x=j*440+round(point['x']*440/1024);y=40+round(point['y']*440/1024);d.line((x-6,y,x+6,y),fill=col,width=2);d.line((x,y-6,x,y+6),fill=col,width=2);d.text((x+7,y),label,fill=col)
sheet.save(A/'_checks/crystal-ball-motion.png');small=Image.new('RGB',(240,140),(246,248,251));bg=Image.new('RGBA',assembled.size,(246,248,251,255));bg.alpha_composite(assembled);small.paste(bg.convert('RGB').resize((40,40)),(30,50));small.paste(bg.convert('RGB').resize((120,120)),(100,10));small.save(A/'_checks/crystal-ball-silhouette.png')
