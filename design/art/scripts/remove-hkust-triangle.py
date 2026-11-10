#!/usr/bin/env python3
"""Remove only Roy's rejected triangle; copy the exact surrounding facade RGBA."""
import hashlib
import json
from collections import deque
from pathlib import Path
from PIL import Image, ImageChops

ROOT=Path(__file__).resolve().parents[1]
CHECKS=ROOT/'_checks'

def main():
    source=CHECKS/'hkust-stamp-before-triangle.png'
    target=ROOT/'stamps/stamp-hkust.png'
    if not source.exists():source.write_bytes(target.read_bytes())
    before=Image.open(source).convert('RGBA');after=before.copy()
    alpha=before.getchannel('A');seed=(512,560)
    assert alpha.getpixel(seed)>200
    component={seed};queue=deque([seed])
    while queue:
        x,y=queue.popleft()
        for dx,dy in ((-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)):
            p=(x+dx,y+dy)
            if p not in component and 0<=p[0]<1024 and 0<=p[1]<1024 and alpha.getpixel(p)>0:
                component.add(p);queue.append(p)
    box=(min(x for x,y in component),min(y for x,y in component),
         max(x for x,y in component)+1,max(y for x,y in component)+1)
    assert 480<=box[0]<box[2]<=550 and 535<=box[1]<box[3]<=600,box
    facade=before.getpixel((480,560))
    # The existing monochrome facade's paper-white is transparent, not white ink.
    assert facade==(47,93,138,0)
    mask=Image.new('L',before.size);m=mask.load()
    for p in component:after.putpixel(p,facade);m[p[0],p[1]]=255
    assert all(a==b for p,(a,b) in enumerate(zip(before.getdata(),after.getdata()))
               if (p%1024,p//1024) not in component)
    after.save(target,optimize=True)
    mask.save(CHECKS/'hkust-triangle-mask.png',optimize=True)
    diff=ImageChops.difference(before,after)
    report={'source':'design/art/_checks/hkust-stamp-before-triangle.png',
            'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
            'output_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
            'method':'8-connected alpha-positive component from seed(512,560); copy exact surrounding facade RGBA',
            'triangle_bbox':list(box),'changed_pixel_count':len(component),
            'facade_sample_xy':[480,560],'facade_rgba':list(facade),
            'all_pixels_outside_triangle_identical':True,
            'rgb_planes_byte_identical':before.convert('RGB').tobytes()==after.convert('RGB').tobytes(),
            'difference_bbox':list(diff.getbbox()),'regenerated':False,'pass':True}
    (CHECKS/'hkust-triangle-fix.json').write_text(json.dumps(report,indent=2)+'\n')
    print('Triangle only:',len(component),'pixels',box,'all other pixels byte-identical')

if __name__=='__main__':main()
