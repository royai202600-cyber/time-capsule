#!/usr/bin/env python3
"""Finish the generated firefly layer for 120px cards, preserving vessel motion.
Extract the generated light centers, fit within the original jar, enlarge
soft cores/halos and reduce the generated opaque wash to a faint warm alpha.
"""
import json,math,runpy
from pathlib import Path
from PIL import Image
R=Path(__file__).resolve().parents[1]; C=R/'_checks'; V=R/'vessels'

def prepare(source):
 im=Image.open(source).convert('RGBA');pix=im.load();seen=set();points=[]
 for y in range(im.height):
  for x in range(im.width):
   r,g,b,a=pix[x,y]
   if min(r,g,b)>242 and a>220 and (x,y) not in seen:
    todo=[(x,y)];seen.add((x,y));comp=[]
    while todo:
     qx,qy=todo.pop();comp.append((qx,qy))
     for nx,ny in ((qx-1,qy),(qx+1,qy),(qx,qy-1),(qx,qy+1)):
      if not(0<=nx<im.width and 0<=ny<im.height) or (nx,ny) in seen:continue
      rr,gg,bb,aa=pix[nx,ny]
      if min(rr,gg,bb)>242 and aa>220:seen.add((nx,ny));todo.append((nx,ny))
    if 8<len(comp)<1500:points.append((sum(p[0] for p in comp)/len(comp),sum(p[1] for p in comp)/len(comp)))
 assert 8<=len(points)<=12,('generated firefly count',len(points))
 points.sort(key=lambda p:p[1]);x0=min(p[0] for p in points);x1=max(p[0] for p in points);y0=min(p[1] for p in points);y1=max(p[1] for p in points)
 points=[(335+(x-x0)*355/(x1-x0),520+(y-y0)*240/(y1-y0)) for x,y in points]
 # Roy's latest direction: FIVE big lights, staggered around a central glow.
 chosen=[]
 for target in ((380,535),(640,565),(510,640),(380,745),(650,745)):
  nearest=min(points,key=lambda p:(p[0]-target[0])**2+(p[1]-target[1])**2);points.remove(nearest);chosen.append(nearest)
 points=chosen
 # Straight RGB with smooth alpha avoids the former grey/dark halo fringes.
 out=Image.new('RGBA',(1024,1024));p=out.load()
 for y in range(450,851):
  for x in range(270,771):
   r2=((x-520)/245)**2+((y-650)/200)**2
   alpha=round(24*max(0,1-r2)**2)
   if alpha:p[x,y]=(255,222,145,alpha)
 for i,(cx,cy) in enumerate(points):
  radius=18+i%4*2;halo=52+i%4*5
  for y in range(round(cy-halo),round(cy+halo+1)):
   for x in range(round(cx-halo),round(cx+halo+1)):
    d=math.hypot(x-cx,y-cy)
    if d>halo:continue
    core=math.exp(-(d/(radius*.82))**4);bloom=max(0,(math.exp(-3*(d/halo)**2)-math.exp(-3))/(1-math.exp(-3)))
    alpha=round(255*max(core,bloom*.68))
    if not alpha:continue
    color=(255,round(211+core*35),round(100+core*101),alpha)
    # Alpha over faint wash, retain warm non-premultiplied color.
    old=p[x,y];a=alpha/255;oa=old[3]/255;total=a+oa*(1-a)
    p[x,y]=tuple(round((color[k]*a+old[k]*oa*(1-a))/total) for k in range(3))+(round(total*255),)
 return out,points

def main():
 cfg=json.loads((C/'t10a-firefly-card-fix.json').read_text());im,pts=prepare(cfg['source']);im.save(V/'vessel-firefly-jar-fireflies.png',optimize=True)
 specs=json.loads((C/'t10a-specs.json').read_text());spec=specs['vessels/vessel-firefly-jar.png'];parts={l['name']:Image.open(V/l['file']).convert('RGBA') for l in spec['layers']};frame=runpy.run_path(str(R/'scripts/finish-batch1.py'))['frame'];frame(parts,spec,0).save(V/'vessel-firefly-jar.png',optimize=True)
 prompts=json.loads((C/'prompts-t10a-extra.json').read_text());prompts['vessels/vessel-firefly-jar-fireflies.png']=cfg['prompt'];(C/'prompts-t10a-extra.json').write_text(json.dumps(prompts,ensure_ascii=False,indent=2)+'\n')
 (C/'firefly-card-check.json').write_text(json.dumps({'count':len(pts),'core_centers':pts,'core_diameter_px':[36,48],'halo_diameter_px':[104,134],'wash_peak_alpha':24,'motion_unchanged':True},indent=2)+'\n');print('fireflies:',len(pts),'larger cores/halos, faint warm wash')
if __name__=='__main__':main()
