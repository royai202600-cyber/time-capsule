#!/usr/bin/env python3
"""T10c-fix: masked colours, octagonal candy art, persistent river candle."""
import colorsys,io,json,runpy,subprocess
from pathlib import Path
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parents[1];C=R/'_checks';V=R/'vessels';BASE='4309b55997b3fdcfe9193b0c7da3983709c28e80'
F=runpy.run_path(str(R/'scripts/finish-b3.py'))
def baseline(path):return subprocess.check_output(['git','show',BASE+':'+path],cwd=R.parent.parent)
def recolour(image,kind):
 im=image.convert('RGBA');p=im.load()
 for y in range(im.height):
  for x in range(im.width):
   r,g,b,a=p[x,y]
   if not a:continue
   h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)
   if kind=='pumpkin' and r>125 and s>.12 and (h<.055 or h>.92):
    h=.085;s=min(.72,s*1.15)
   elif kind=='rice-dumpling' and b>r*1.1 and b>g*1.03 and v>.25:
    h=.455;s=max(.22,min(.65,s*.95));v*=.93
   else:continue
   rr,gg,bb=colorsys.hsv_to_rgb(h,s,v);p[x,y]=(round(rr*255),round(gg*255),round(bb*255),a)
 return im

def main():
 cfg=json.loads((C/'b3-fix-config.json').read_text());specs=json.loads(baseline('design/art/_checks/b3-specs.json'));prompts=json.loads(baseline('design/art/_checks/b3-prompts.json'))
 for id in ('pumpkin','rice-dumpling'):
  parts={}
  for layer in specs[id]['layers']:
   path=layer['file'];im=Image.open(io.BytesIO(baseline('design/art/vessels/'+path))).convert('RGBA')
   if id=='rice-dumpling' or layer['name']!='glow':im=recolour(im,id)
   im.save(V/path,optimize=True);parts[layer['name']]=im
  F['render'](parts,specs[id],0).save(V/f'vessel-{id}.png',optimize=True)
 src=F['clean'](Image.open(C/'b3-fix-candy-source.png'));body=F['clean'](Image.open(C/'b3-fix-candy-body.png'))
 m=Image.new('L',src.size);ImageDraw.Draw(m).polygon([(195,0),(1053,0),(1053,678),(850,863),(395,863),(200,680)],fill=255)
 lid=F['cut'](src,m);b=F['box'](src);scale=703/(b[2]-b[0]);scale_y=(902-233)/(b[3]-288);dx=512.5-(b[0]+b[2])*scale/2;dy=233-288*scale_y
 assert max(scale,scale_y)<1,'Never upscale an edit'
 parts={}
 for name,im in (('box',body),('lid',lid)):
  small=im.resize((round(im.width*scale),round(im.height*scale_y)),Image.Resampling.LANCZOS);out=Image.new('RGBA',(1024,1024));out.alpha_composite(small,(round(dx),round(dy)));alpha=out.getchannel('A');ImageDraw.Draw(alpha).rectangle((0,902,1023,1023),fill=0);out.putalpha(alpha.point(lambda a:a if a>=8 else 0));parts[name]=out;out.save(V/f'vessel-candy-box-{name}.png',optimize=True)
 assembled=F['render'](parts,specs['candy-box'],0);assembled.save(V/'vessel-candy-box.png',optimize=True)
 prompts['vessels/vessel-candy-box.png']=cfg['candy_prompt'];prompts['vessels/vessel-candy-box-lid.png']=cfg['candy_prompt'];prompts['vessels/vessel-candy-box-box.png']=cfg['candy_body_prompt']
 for layer in specs['river-lantern']['layers']:
  if layer['name']=='glow':
   for key in layer['open']:key['opacity']=1
 (C/'b3-specs.json').write_text(json.dumps(specs,indent=2)+'\n');(C/'b3-prompts.json').write_text(json.dumps(prompts,ensure_ascii=False,indent=2)+'\n')
 old=json.loads(baseline('design/art/_checks/b3-specs.json'));expected=json.loads(json.dumps(old))
 for l in expected['river-lantern']['layers']:
  if l['name']=='glow':
   for k in l['open']:k['opacity']=1
 assert specs==expected,'Unexpected motion change'
 print('Applied four requested changes; motion differs only in river glow opacity.')
if __name__=='__main__':main()
