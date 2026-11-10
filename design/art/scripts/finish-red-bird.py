#!/usr/bin/env python3
"""Place GPT Image 2 closed/reveal/isolation edits on one shared vessel canvas."""
import json
import runpy
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter

ROOT=Path(__file__).resolve().parents[1]
CHECKS=ROOT/'_checks'
VESSELS=ROOT/'vessels'
PAPER=(246,248,251,255)

def clean(image):
    image=image.convert('RGBA')
    image.putalpha(image.getchannel('A').point(lambda a:a if a>16 else 0))
    return image

def main():
    sources={n:clean(Image.open(CHECKS/f'red-bird-{n}-source.png'))
             for n in ('closed','box','lid','shadow')}
    assert all(im.size==(1254,1254) for im in sources.values())
    scale=1024/1254
    box=sources['box'].getchannel('A').point(lambda a:255 if a>=200 else 0).getbbox()
    # Same full-canvas resize and translation for ALL layers; never individual fitting.
    dx=round(512-(box[0]+box[2])/2*scale)
    dy=900-round((box[3]-1)*scale)
    def point(x,y):return {'x':round(x*scale+dx),'y':round(y*scale+dy)}
    def place(im):
        out=Image.new('RGBA',(1024,1024))
        out.alpha_composite(im.resize((1024,1024),Image.Resampling.LANCZOS),(dx,dy))
        return out
    # Only soften the generated cast-shadow cutout; no new object geometry is drawn.
    shadow=sources['shadow']
    alpha=shadow.getchannel('A').filter(ImageFilter.GaussianBlur(4))
    # Keep the cast shadow on the dial, rather than painting over its red pointer.
    mask=Image.new('L',shadow.size);mp=mask.load();lp=sources['lid'].load()
    for y in range(shadow.height):
        for x in range(shadow.width):
            r,g,b,a=lp[x,y]
            if a>20 and r>g*1.2 and r>b*1.12 and r>85:mp[x,y]=255
    alpha=ImageChops.subtract(alpha,mask)
    shadow.putalpha(alpha.point(lambda a:a if a>2 else 0))
    sources['shadow']=shadow
    parts={n:place(sources[n]) for n in ('box','lid','shadow')}
    for name,im in parts.items():im.save(VESSELS/f'vessel-red-bird-{name}.png',optimize=True)
    hinge=point(810,710);foot=point(630,860)
    spec={'id':'red-bird','assembled':'vessel-red-bird.png','opening':'A','idleMs':4200,'idle':[],
          'layers':[{'name':'box','file':'vessel-red-bird-box.png','role':'static'},
                    {'name':'lid','file':'vessel-red-bird-lid.png','role':'hinge','pivot':hinge,
                     'open':[{'at':0,'rotate':0,'y':0,'scaleY':1,'opacity':1},
                             {'at':1,'rotate':-15,'y':-.12,'scaleY':.65,'opacity':1}]},
                    {'name':'shadow','file':'vessel-red-bird-shadow.png','role':'hinge','pivot':hinge,
                     'open':[{'at':0,'rotate':0,'y':0,'scaleY':1,'opacity':1},
                             {'at':1,'rotate':-15,'y':-.12,'scaleY':.65,'opacity':1}],
                     'idle':[{'type':'sway','deg':4,'pivot':foot}]}],
          'mouth':point(625,855),'baseY':900,'sparkle':point(360,960),
          'glint':None,'openGlow':None,'readyPulse':None}
    frame=runpy.run_path(str(ROOT/'scripts/finish-batch1.py'))['frame']
    assembled=frame(parts,spec,0)
    assembled.save(VESSELS/'vessel-red-bird.png',optimize=True)
    (CHECKS/'red-bird-vessel.json').write_text(json.dumps(spec,indent=2)+'\n')
    normalization={'native_size':[1254,1254],'scale':scale,'translation':[dx,dy],
                   'one_common_transform':True,'never_upscaled':True,
                   'hinge_source_px':[810,710],'bird_foot_source_px':[630,860],
                   'mouth_source_px':[625,855],'sparkle_source_px':[360,960],
                   'postprocess':'alpha<=16 dust removed; common full-canvas resize/translation; generated shadow blurred4px and clipped off red pointer; closed assembled re-composited from exact rest layers.'}
    (CHECKS/'red-bird-normalization.json').write_text(json.dumps(normalization,indent=2)+'\n')
    print('Shared transform',scale,(dx,dy),'hinge',hinge,'foot',foot)

if __name__=='__main__':main()
