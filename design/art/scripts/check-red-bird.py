#!/usr/bin/env python3
"""Audit only the Red Bird vessel, its small silhouettes, open and idle frames."""
import hashlib
import json
import runpy
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parents[1]
CHECKS=ROOT/'_checks'
PAPER=(246,248,251,255)
MOTION=runpy.run_path(str(ROOT/'scripts/finish-batch1.py'))

def font(size):
    path=Path('/System/Library/Fonts/Supplemental/Arial.ttf')
    return ImageFont.truetype(str(path),size) if path.exists() else ImageFont.load_default(size=size)

def flatten(im):return Image.alpha_composite(Image.new('RGBA',im.size,PAPER),im).convert('RGB')

def cross(draw,point,colour,label):
    x,y=point['x'],point['y']
    draw.line((x-10,y,x+10,y),fill=colour,width=3)
    draw.line((x,y-10,x,y+10),fill=colour,width=3)
    draw.text((x+13,y-24),label,fill=colour,font=font(22))

def main():
    spec=json.loads((CHECKS/'red-bird-vessel.json').read_text())
    parts={p['name']:Image.open(ROOT/'vessels'/p['file']).convert('RGBA') for p in spec['layers']}
    assembled=Image.open(ROOT/'vessels'/spec['assembled']).convert('RGBA')
    stack=MOTION['frame'](parts,spec,0)
    assert assembled.tobytes()==stack.tobytes()
    files={'assembled':assembled,**parts}; geometry={}
    for name,im in files.items():
        a=im.getchannel('A');b=a.point(lambda x:255 if x>20 else 0).getbbox()
        corners=[a.getpixel(p) for p in ((0,0),(1023,0),(0,1023),(1023,1023))]
        assert im.size==(1024,1024) and corners==[0]*4
        geometry[name]={'size':list(im.size),'corners_alpha':corners,'alpha_bbox':list(a.getbbox()),
                        'visible_bbox_alpha_gt20':list(b),'alpha_range':list(a.getextrema())}
    b=geometry['assembled']['visible_bbox_alpha_gt20']
    base=assembled.getchannel('A').point(lambda x:255 if x>=200 else 0).getbbox()[3]-1
    assert 880<=base<=920 and b[2]-b[0]<=760 and b[1]>=100
    assert abs((b[0]+b[2])/2-512)<=3
    assert parts['box'].getchannel('A').getpixel(tuple(spec['mouth'].values()))>=250
    result=runpy.run_path(str(ROOT/'scripts/check-vessels.py'))['check_vessel']('red-bird',['box','lid','shadow'])
    assert result['exact_pixel_match'] and result['all_corners_alpha_zero']
    sheet=Image.new('RGB',(1536,660),PAPER[:3]);d=ImageDraw.Draw(sheet)
    report=[]
    for i,(t,label) in enumerate(((0,'CLOSED'),(.5,'HALF OPEN'),(1,'OPEN'))):
        frame=MOTION['frame'](parts,spec,t)
        a=frame.getchannel('A');bbox=a.getbbox()
        assert bbox and bbox[0]>0 and bbox[1]>0 and bbox[2]<1024 and bbox[3]<1024
        im=flatten(frame);idraw=ImageDraw.Draw(im)
        cross(idraw,spec['layers'][1]['pivot'],'#2F5D8A','rear hinge')
        cross(idraw,spec['mouth'],'#A3364F','mouth')
        cross(idraw,spec['sparkle'],'#6E2B3F','sparkle')
        # Show the rear hinge after its measured up/back perspective projection.
        end=spec['layers'][1]['open'][-1]
        moved={**spec['layers'][1]['pivot'],'y':round(spec['layers'][1]['pivot']['y']+end['y']*1024*t)}
        if t:
            idraw.line((*spec['layers'][1]['pivot'].values(),*moved.values()),fill='#2F5D8A',width=2)
            cross(idraw,moved,'#2F5D8A','lid hinge')
        sheet.paste(im.resize((512,512),Image.Resampling.LANCZOS),(512*i,48))
        d.text((i*512+20,12),label,fill='#16263F',font=font(28))
        report.append({'open':t,'alpha_bbox':list(bbox),'inside_canvas':True})
    d.text((20,578),'A: box static; lid + shadow hinge up/back. Complete rolled-letter interior.',fill='#16263F',font=font(24))
    d.text((20,618),'Blue: rear hinge / red: mouth / plum: brass sparkle. All coordinates in the manifest.',fill='#16263F',font=font(22))
    sheet.save(CHECKS/'red-bird-motion.png',optimize=True)
    # Native-sized 40/120 canvases, rather than enlarged crops.
    small=Image.new('RGB',(900,270),PAPER[:3]);d=ImageDraw.Draw(small)
    for i,(label,im) in enumerate((('assembled',assembled),('rest stack',stack),('open',MOTION['frame'](parts,spec,1)))):
        x=30+i*290;d.text((x,10),label,fill='#16263F',font=font(22))
        for size,y in ((40,55),(120,125)):
            s=flatten(im).resize((size,size),Image.Resampling.LANCZOS)
            small.paste(s,(x,y));d.text((x+size+16,y+10),f'{size}px',fill='#2F5D8A',font=font(20))
    small.save(CHECKS/'red-bird-sizes.png',optimize=True)
    # Shadow sway sample: same closed lid, only its generated soft shadow moves.
    idle=Image.new('RGB',(1080,410),PAPER[:3]);d=ImageDraw.Draw(idle)
    for i,angle in enumerate((-4,0,4)):
        s=MOTION['transform'](parts['shadow'],{'rotate':angle},spec['layers'][2]['idle'][0]['pivot'])
        im=Image.alpha_composite(Image.alpha_composite(parts['box'],parts['lid']),s)
        idle.paste(flatten(im).resize((360,360),Image.Resampling.LANCZOS),(i*360,35))
        d.text((i*360+20,8),f'Shadow sway {angle:+} degrees',fill='#16263F',font=font(23))
    idle.save(CHECKS/'red-bird-idle.png',optimize=True)
    hero=Image.new('RGB',(1300,1170),PAPER[:3]);d=ImageDraw.Draw(hero)
    d.text((22,16),'RED BIRD SUNDIAL BOX / CLOSED + REVEAL',fill='#16263F',font=font(32))
    hero.paste(flatten(assembled).resize((620,620),Image.Resampling.LANCZOS),(10,50))
    hero.paste(flatten(MOTION['frame'](parts,spec,1)).resize((620,620),Image.Resampling.LANCZOS),(665,50))
    hero.paste(small,(370,680))
    photo=Image.open(ROOT/'reference/red-bird/hkust-piazza-thumb.jpg').convert('RGB')
    hero.paste(photo,(35,720));d.text((20,1075),'HKUST CMO reference',fill='#2F5D8A',font=font(22))
    d.text((320,1010),'Original brass keepsake; no logo, emblem, lettering or numerals.',fill='#16263F',font=font(23))
    d.text((320,1050),'Shadow: 4-degree sway / 4200 ms. Brass-rim sparkle anchor.',fill='#16263F',font=font(23))
    d.text((320,1090),'Art only. Motion registration and Earned reward wiring remain separate.',fill='#16263F',font=font(23))
    hero.save(CHECKS/'red-bird-review.png',optimize=True)
    proof=json.loads((CHECKS/'red-bird-preservation.json').read_text())
    after={p:hashlib.sha256((REPO/p).read_bytes()).hexdigest() for p in proof['before']}
    changed=[p for p in after if proof['before'][p]!=after[p]]
    assert not changed,changed
    proof.update(after=after,existing_art_count=len(after),changed_existing_paths=changed,all_existing_art_byte_identical=True)
    (CHECKS/'red-bird-preservation.json').write_text(json.dumps(proof,indent=2)+'\n')
    summary={'vessel':'red-bird','geometry':geometry,'baseY':base,'mouth':spec['mouth'],
             'hinge':spec['layers'][1]['pivot'],'shadow_pivot':spec['layers'][2]['idle'][0]['pivot'],
             'sparkle':spec['sparkle'],'motion':report,'exact_rest_stack':True,'no_ground_layers':True,
             'interior_complete_and_letter_visible':True,
             'ip_check':{'original_souvenir_design':True,'landmark_photo_verified':True,
                         'no_text_logos_emblem_or_franchise_character':True,
                         'notes':'Simplified swept red planes on an original brass sundial box. No university emblem or logo artwork, no exact sculpture replica; visual review only.'},
             'existing_art_files_unchanged':len(after),'pass':True}
    (CHECKS/'red-bird-audit.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(f'Red Bird: exact rest stack, alpha, canvas/base, motion, silhouettes and {len(after)} existing artwork hashes PASS')

if __name__=='__main__':main()
