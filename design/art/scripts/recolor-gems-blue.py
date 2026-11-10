#!/usr/bin/env python3
"""Derive the blue pre-spin gems by RGB-only lightness remapping. Never redraw."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RAMP = ((22,38,63),(47,93,138),(90,143,208))

def lightness(rgb):
    return (min(rgb)+max(rgb))/510

def ramp_at(t):
    t = max(0,min(1,t))
    a,b,f = (RAMP[0],RAMP[1],t*2) if t <= .5 else (RAMP[1],RAMP[2],(t-.5)*2)
    return tuple(round(x+(y-x)*f) for x,y in zip(a,b))

def main():
    common = Image.open(ROOT/'game/waypost-gem.png').convert('RGBA')
    values = sorted(lightness(p[:3]) for p in common.getdata() if p[3] >= 200)
    low,high = values[round(len(values)*.01)],values[round(len(values)*.99)]
    assert low < high
    records=[]
    for name,factor in (('waypost-gem',1.0),('landmark-gem',.8)):
        source = ROOT/'game'/f'{name}.png'
        before = source.read_bytes()
        im = Image.open(source).convert('RGBA')
        output=[]
        for r,g,b,a in im.getdata():
            if a == 0:
                output.append((r,g,b,a))
                continue
            # The approved Landmark source already has RGB ×0.8. Undo this
            # known derivation before the shared ramp, then reapply it once.
            rgb=tuple(min(255,c/factor) for c in (r,g,b))
            t=(lightness(rgb)-low)/(high-low)
            blue=ramp_at(t)
            output.append(tuple(round(c*factor) for c in blue)+(a,))
        out=Image.new('RGBA',im.size);out.putdata(output)
        target=ROOT/'game'/f'{name}-blue.png';out.save(target,optimize=True)
        assert out.size==im.size==(1024,1024)
        assert out.getchannel('A').tobytes()==im.getchannel('A').tobytes()
        assert source.read_bytes()==before
        records.append({'source':str(source.relative_to(ROOT)),'output':str(target.relative_to(ROOT)),
          'source_sha256':hashlib.sha256(before).hexdigest(),'size':[1024,1024],
          'alpha_byte_identical':True,'alpha_bbox':list(out.getchannel('A').getbbox()),
          'lightness_bounds':[low,high],'blue_ramp':['#16263F','#2F5D8A','#5A8FD0'],
          'landmark_rgb_factor':factor,'generated':False,'pass':True})
    (ROOT/'_checks/city-hunt-gems.json').write_text(json.dumps(records,indent=2)+'\n')
    print('2/2 gems: RGB-only remap; exact source alpha, placement and original hashes PASS')

if __name__=='__main__':
    main()
