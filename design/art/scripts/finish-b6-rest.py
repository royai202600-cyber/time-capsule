from PIL import Image,ImageDraw,ImageFilter,ImageChops
from pathlib import Path
import runpy,json
A=Path(__file__).resolve().parents[1];S=A/'_checks/b6-sources';F=runpy.run_path(str(A/'scripts/finish-batch1.py'))['frame'];paper=(246,248,251,255)
configs={'wishing-lamp':{'part':'lid','box':(375,500,820,715),'radius':55,'opening':'C','body':'lamp','idle':[{'type':'bob','amount':.025}]},'pocket-watch':{'part':'cover','box':(300,480,875,1037),'radius':265,'opening':'A','body':'watch','idle':[{'type':'sway','deg':4}]},'baby-shoes':{'part':'lid','box':(235,440,995,865),'radius':65,'opening':'B','body':'box','idle':[{'type':'breathe','amount':.025}]},'rocket-tin':{'part':'cone','box':(470,245,785,505),'radius':90,'opening':'C','body':'rocket','idle':[{'type':'float','amount':.03}]}}
for id,z in configs.items():
 c=Image.open(S/f'{id}-closed.png').convert('RGBA');r=Image.open(S/f'{id}-reveal.png').convert('RGBA');box=z['box'];m=Image.new('L',c.size);ImageDraw.Draw(m).rounded_rectangle(box,radius=z['radius'],fill=255);
 if id=='baby-shoes':
  m=Image.new('L',c.size);ImageDraw.Draw(m).polygon([(200,400),(1050,400),(1050,710),(945,810),(810,941),(750,950),(250,875),(200,865)],fill=255)
 m=m.filter(ImageFilter.GaussianBlur(2));body=r.copy() if id=='baby-shoes' else Image.composite(r,c,m);lid=Image.new('RGBA',c.size);lid.paste(c,(0,0),m)
 extra=None
 if id=='wishing-lamp':
  smoke_mask=Image.new('L',c.size);ImageDraw.Draw(smoke_mask).rectangle((0,0,1253,496),fill=255);extra=Image.new('RGBA',c.size);extra.paste(c,(0,0),smoke_mask);alpha=extra.getchannel('A').filter(ImageFilter.GaussianBlur(3)).point(lambda a:round(a*.65));extra=Image.new('RGBA',c.size,(150,181,207,0));extra.putalpha(alpha);body.paste((0,0,0,0),(0,0,1254,497))
 if id=='rocket-tin':
  extra=Image.new('RGBA',c.size);g=Image.new('L',c.size);d=ImageDraw.Draw(g);d.polygon([(568,1090),(682,1090),(670,1160),(625,1230),(580,1160)],fill=175);g=g.filter(ImageFilter.GaussianBlur(18));extra.paste((243,226,187,0),(0,0,1254,1254));extra.putalpha(g)
 alpha=c.getchannel('A')
 if extra:alpha=ImageChops.lighter(alpha,extra.getchannel('A'))
 bb=alpha.point(lambda a:255 if a>20 else 0).getbbox();l,t,rr,b=bb;scale=min(1,700/(rr-l),740/(b-t));dx=512-(l+rr)*scale/2;dy=890-b*scale
 def norm(im):
  o=Image.new('RGBA',(1024,1024));o.alpha_composite(im.resize((round(1254*scale),round(1254*scale)),Image.Resampling.LANCZOS),(round(dx),round(dy)));return o
 def pt(x,y):return {'x':round(x*scale+dx),'y':round(y*scale+dy)}
 parts={z['body']:norm(body),z['part']:norm(lid)}
 layers=[{'name':z['body'],'file':f'vessel-{id}-{z["body"]}.png','role':'static'}]
 if extra:
  en='smoke' if id=='wishing-lamp' else 'flame';parts[en]=norm(extra);layers.append({'name':en,'file':f'vessel-{id}-{en}.png','role':'fade','open':[{'at':0,'opacity':1},{'at':1,'opacity':0 if en=='smoke' else 1}],'idle':[{'type':'drift','amount':.03} if en=='smoke' else {'type':'glow','base':.8,'range':.2,'flicker':.1}]})
 end={'y':-.4,'opacity':0};pivot=pt((box[0]+box[2])/2,box[1]);
 if id=='pocket-watch':end={'scaleX':.03,'opacity':0};pivot=pt(850,750)
 layers.append({'name':z['part'],'file':f'vessel-{id}-{z["part"]}.png','role':'hinge' if id=='pocket-watch' else 'lift','pivot':pivot,'open':[{'at':0,'opacity':1},{'at':1,**end}]})
 if id=='pocket-watch':z['idle'][0]['pivot']=pt(625,250)
 spec={'id':id,'opening':z['opening'],'idleMs':4000,'idle':z['idle'],'layers':layers,'mouth':pt((box[0]+box[2])/2,box[3]-35),'baseY':0,'sparkle':pt({'wishing-lamp':435,'pocket-watch':425,'baby-shoes':535,'rocket-tin':625}[id],{'wishing-lamp':680,'pocket-watch':565,'baby-shoes':610,'rocket-tin':475}[id]),'glint':None,'openGlow':None,'readyPulse':None}
 assembled=F(parts,spec,0);a=assembled.getchannel('A').point(lambda v:255 if v>20 else 0).getbbox();spec['baseY']=a[3]-1
 assert a[2]-a[0]<=760 and a[1]>=100 and 880<=spec['baseY']<=920,(id,a)
 for n,im in parts.items():im.save(A/'vessels'/f'vessel-{id}-{n}.png',optimize=True)
 assembled.save(A/'vessels'/f'vessel-{id}.png',optimize=True);(A/'_checks'/f'{id}-vessel.json').write_text(json.dumps(spec,indent=2)+'\n')
 sheet=Image.new('RGB',(1320,550),paper[:3]);draw=ImageDraw.Draw(sheet)
 for j,t in enumerate([0,.5,1]):
  im=F(parts,spec,t);bg=Image.new('RGBA',im.size,paper);bg.alpha_composite(im);sheet.paste(bg.convert('RGB').resize((440,440)),(j*440,40));draw.text((j*440+12,10),['CLOSED','HALF','OPEN'][j],fill=(22,38,63))
  for p,label,col in [(pivot,'pivot',(163,54,79)),(spec['mouth'],'mouth',(22,38,63)),(spec['sparkle'],'sparkle',(201,161,90))]:
   x=j*440+round(p['x']*440/1024);y=40+round(p['y']*440/1024);draw.line((x-6,y,x+6,y),fill=col,width=2);draw.line((x,y-6,x,y+6),fill=col,width=2);draw.text((x+7,y),label,fill=col)
 sheet.save(A/'_checks'/f'{id}-motion.png');small=Image.new('RGB',(240,140),paper[:3]);bg=Image.new('RGBA',assembled.size,paper);bg.alpha_composite(assembled);small.paste(bg.convert('RGB').resize((40,40)),(30,50));small.paste(bg.convert('RGB').resize((120,120)),(100,10));small.save(A/'_checks'/f'{id}-silhouette.png')
 print(id,a,'exact',assembled.tobytes()==F(parts,spec,0).tobytes())
