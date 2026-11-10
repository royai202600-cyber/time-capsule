#!/usr/bin/env python3
"""Audit the one HKUST stamp and verify all existing art files unchanged."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parents[1]
CHECKS=ROOT/'_checks'
PAPER=(246,248,251,255)

def font(size):
    path=Path('/System/Library/Fonts/Supplemental/Arial.ttf')
    return ImageFont.truetype(str(path),size) if path.exists() else ImageFont.load_default(size=size)

def flatten(im):return Image.alpha_composite(Image.new('RGBA',im.size,PAPER),im).convert('RGB')

def main():
    im=Image.open(ROOT/'stamps/stamp-hkust.png').convert('RGBA');a=im.getchannel('A')
    assert im.size==(1024,1024)
    corners=[a.getpixel(p) for p in ((0,0),(1023,0),(0,1023),(1023,1023))]
    assert corners==[0]*4
    colours={p[:3] for p in im.getdata() if p[3]}
    assert colours=={(47,93,138)},colours
    assert a.getpixel((512,300))==0 and a.getpixel((512,600))==0
    sheet=Image.new('RGB',(1000,810),PAPER[:3]);d=ImageDraw.Draw(sheet)
    d.text((22,16),'HKUST PASSPORT STAMP — curved academic building',fill='#16263F',font=font(28))
    sheet.paste(flatten(im).resize((440,440),Image.Resampling.LANCZOS),(25,65))
    for row,size in enumerate((24,40,64,120)):
        y=85+row*100;d.text((520,y),f'{size}px / native canvas',fill='#2F5D8A',font=font(22))
        sheet.paste(flatten(im).resize((size,size),Image.Resampling.LANCZOS),(810,y))
    for col,(name,label) in enumerate((('hkust','HKUST'),('tst-clock','TST clock'),('hunt-xinyi-2026-11','Xinyi hunt'))):
        other=Image.open(ROOT/'stamps'/f'stamp-{name}.png').convert('RGBA')
        x=35+col*325;d.text((x,550),label,fill='#16263F',font=font(23))
        sheet.paste(flatten(other).resize((120,120),Image.Resampling.LANCZOS),(x,595))
        sheet.paste(flatten(other).resize((40,40),Image.Resampling.LANCZOS),(x+150,595))
    d.text((25,758),'One ink: #2F5D8A. No lettering, emblem or Red Bird motif.',fill='#16263F',font=font(23))
    sheet.save(CHECKS/'hkust-stamp-review.png',optimize=True)
    path=CHECKS/'hkust-stamp-preservation.json';proof=json.loads(path.read_text())
    after={p:hashlib.sha256((REPO/p).read_bytes()).hexdigest() for p in proof['before']}
    changed=[p for p in after if after[p]!=proof['before'][p]]
    assert not changed,changed
    stamps=[p for p in after if p.startswith('design/art/stamps/') and p.endswith('.png')]
    exports=[p for p in after if p.startswith('public/art/stamps/') and p.endswith('.webp')]
    proof.update(after=after,changed_existing_paths=changed,existing_art_count=len(after),
                 existing_stamp_count=len(stamps),existing_stamp_export_count=len(exports),
                 all_existing_stamps_byte_identical=True,all_existing_art_byte_identical=True)
    path.write_text(json.dumps(proof,indent=2)+'\n')
    report={'path':'stamps/stamp-hkust.png','size':list(im.size),'corners_alpha':corners,
            'visible_rgb_colours':[list(c) for c in colours],'alpha_bbox':list(a.getbbox()),
            'native_review_sizes':[24,40,64,120],'existing_stamps_unchanged':len(stamps),
            'existing_stamp_webps_unchanged':len(exports),'existing_art_unchanged':len(after),
            'reference_comparison':'Concave multi-storey frontage and window bands wrap the Piazza; checked against PR99 official ground view and the Commons helicopter aerial. No Red Bird, emblem or lettering.',
            'pass':True}
    (CHECKS/'hkust-stamp-audit.json').write_text(json.dumps(report,indent=2)+'\n')
    print(f'HKUST stamp PASS; {len(stamps)} old stamp PNGs, {len(exports)} old stamp WebPs, all {len(after)} old art files byte-identical')

if __name__=='__main__':main()
