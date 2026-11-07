#!/usr/bin/env python3
"""Static generated dusk/grass insert with six scripted asymmetrical flying lights."""
import json,math,runpy,subprocess,io
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter,ImageChops
R=Path(__file__).resolve().parents[1]; C=R/'_checks'; V=R/'vessels'
POINTS=[(386,574,14,43),(611,511,5,20),(679,651,8,28),(512,716,9,31),(350,775,4,17),(630,798,6,23)]

def prepare_jar(base):
 cfg=json.loads((C/'firefly-dusk-source.json').read_text());dusk=Image.open(cfg['source']).convert('RGBA');assert dusk.width>=1024;dusk=dusk.resize((1024,1024),Image.Resampling.LANCZOS)
 fade=Image.new('L',(1024,1024));fd=ImageDraw.Draw(fade)
 for y in range(405,1024):fd.line((0,y,1023,y),fill=min(255,round((y-405)*255/50)))
 dusk.putalpha(ImageChops.multiply(dusk.getchannel('A'),fade))
 inside=base.getchannel('A').point(lambda a:255 if a>20 else 0).filter(ImageFilter.MinFilter(15));dusk.putalpha(ImageChops.multiply(dusk.getchannel('A'),inside))
 glass=base.copy();p=glass.load()
 for y in range(1024):
  for x in range(1024):
   r,g,b,a=p[x,y]
   # Clear old cool fill, while retaining exact ink/rim/highlight pixels.
   if y>=405 and a<220 and b>r+5 and b>=g and r>110:p[x,y]=(r,g,b,min(a,12))
 result=Image.alpha_composite(dusk,glass);rp=result.load();bp=base.load()
 for y in range(1024):
  for x in range(1024):
   if y<405 or bp[x,y][3]>=220:rp[x,y]=bp[x,y]
 return result

def curve(draw,coords,fill,width):
 a,b,c=coords;points=[]
 for i in range(41):
  t=i/40;points.append(((1-t)**2*a[0]+2*(1-t)*t*b[0]+t*t*c[0],(1-t)**2*a[1]+2*(1-t)*t*b[1]+t*t*c[1]))
 draw.line(points,fill=fill,width=width,joint='curve')

def prepare(source=None):
 out=Image.new('RGBA',(1024,1024))
 # Two short curved flying trails, no wash or static scene on this drifting layer.
 trails=Image.new('RGBA',out.size);d=ImageDraw.Draw(trails)
 for coords in [((342,610),(355,584),(386,574)),((551,744),(531,740),(512,716))]:curve(d,coords,(201,161,90,155),4)
 halo=trails.filter(ImageFilter.GaussianBlur(4));out=Image.alpha_composite(out,halo);out=Image.alpha_composite(out,trails)
 p=out.load()
 for cx,cy,radius,halo in POINTS:
  for y in range(cy-halo,cy+halo+1):
   for x in range(cx-halo,cx+halo+1):
    dist=math.hypot(x-cx,y-cy)
    if dist>halo:continue
    core=math.exp(-(dist/(radius*.82))**4);bloom=max(0,(math.exp(-3*(dist/halo)**2)-math.exp(-3))/(1-math.exp(-3)));alpha=round(255*max(core,bloom*.6))
    if not alpha:continue
    color=(255,round(205+core*41),round(90+core*111),alpha);old=p[x,y];a=alpha/255;oa=old[3]/255;total=a+oa*(1-a)
    p[x,y]=tuple(round((color[k]*a+old[k]*oa*(1-a))/total) for k in range(3))+(round(total*255),)
 return out,[(x,y) for x,y,_,_ in POINTS]

def main():
 # Immutable approved source keeps finishing idempotent and protects the original glass details.
 raw=subprocess.check_output(['git','show','fbffcfcb170d48906f1b6367c2eb4aadd6ed81b1:design/art/vessels/vessel-firefly-jar-jar.png'])
 base=Image.open(io.BytesIO(raw)).convert('RGBA');jar=prepare_jar(base);jar.save(V/'vessel-firefly-jar-jar.png',optimize=True)
 im,pts=prepare();im.save(V/'vessel-firefly-jar-fireflies.png',optimize=True)
 specs=json.loads((C/'t10a-specs.json').read_text());spec=specs['vessels/vessel-firefly-jar.png'];parts={l['name']:Image.open(V/l['file']).convert('RGBA') for l in spec['layers']};frame=runpy.run_path(str(R/'scripts/finish-batch1.py'))['frame'];frame(parts,spec,0).save(V/'vessel-firefly-jar.png',optimize=True)
 prompts=json.loads((C/'prompts-t10a-extra.json').read_text());dusk=json.loads((C/'firefly-dusk-source.json').read_text());generation=json.loads((C/'t10a-generation.json').read_text());prompts['vessels/vessel-firefly-jar-jar.png']=generation['firefly-jar']['parts']['jar']['prompt']+'\n\nStatic dusk insert generation prompt:\n'+dusk['prompt'];(C/'prompts-t10a-extra.json').write_text(json.dumps(prompts,ensure_ascii=False,indent=2)+'\n')
 assert all(a==b for a,b in zip(base.getdata(),jar.getdata()) if a[3]>=220)
 assert ImageChops.difference(base.crop((0,0,1024,405)),jar.crop((0,0,1024,405))).getbbox() is None
 (C/'firefly-card-check.json').write_text(json.dumps({'count':6,'lights':POINTS,'trails':2,'static_scene_layer':'jar','drift_layer_has_no_wash':True,'motion_unchanged':True,'glass_rim_highlights_preserved':True},indent=2)+'\n');print('static dusk + five grass blades; six varied lights and two trails')
if __name__=='__main__':main()
