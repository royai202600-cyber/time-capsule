#!/usr/bin/env python3
"""Audit the one HKUST stamp and verify all existing art files unchanged."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parents[1]
CHECKS=ROOT/'_checks'
PAPER=(246,248,251,255)

def font(size):
    path=Path('/System/Library/Fonts/Supplemental/Arial.ttf')
    return ImageFont.truetype(str(path),size) if path.exists() else ImageFont.load_default(size=size)

def flatten(im):return Image.alpha_composite(Image.new('RGBA',im.size,PAPER),im).convert('RGB')

def main():
    names=(('hkust','HKUST place / single ring'),('hunt-hkust-2026-11','HKUST hunt / double ring'),('hunt-xinyi-2026-11','Xinyi hunt / double ring'))
    images={name:Image.open(ROOT/'stamps'/f'stamp-{name}.png').convert('RGBA') for name,label in names}
    audits={}
    for name in ('hkust','hunt-hkust-2026-11'):
        im=images[name];a=im.getchannel('A')
        assert im.size==(1024,1024)
        corners=[a.getpixel(p) for p in ((0,0),(1023,0),(0,1023),(1023,1023))]
        assert corners==[0]*4
        colours={p[:3] for p in im.getdata() if p[3]}
        assert colours=={(47,93,138)},colours
        audits[name]={'size':list(im.size),'corners_alpha':corners,
                      'visible_rgb_colours':[list(c) for c in colours],'alpha_bbox':list(a.getbbox()),'pass':True}
    im=images['hkust'];before=Image.open(CHECKS/'hkust-stamp-before-triangle.png').convert('RGBA')
    mask=Image.open(CHECKS/'hkust-triangle-mask.png').convert('L')
    assert before.convert('RGB').tobytes()==im.convert('RGB').tobytes()
    difference=ImageChops.difference(before.getchannel('A'),im.getchannel('A'))
    assert ImageChops.multiply(difference,ImageChops.invert(mask)).getbbox() is None
    changed_count=sum(v!=0 for v in difference.getdata());assert changed_count==1467
    assert im.getpixel((512,560))==(47,93,138,0)
    sheet=Image.new('RGB',(1200,970),PAPER[:3]);d=ImageDraw.Draw(sheet)
    d.text((22,16),'HKUST PLACE + CITY HUNT STAMPS — review beside Xinyi',fill='#16263F',font=font(28))
    for col,(name,label) in enumerate(names):
        x=col*400;other=images[name]
        d.text((x+20,65),label,fill='#16263F',font=font(21))
        sheet.paste(flatten(other).resize((350,350),Image.Resampling.LANCZOS),(x+25,105))
        for row,size in enumerate((24,40,64,120)):
            y=500+row*95
            d.text((x+30,y+5),f'{size}px',fill='#2F5D8A',font=font(21))
            sheet.paste(flatten(other).resize((size,size),Image.Resampling.LANCZOS),(x+175,y))
    d.text((22,920),'Place triangle: script only; 1467 pixels cleared. All other place pixels unchanged.',fill='#16263F',font=font(24))
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
    report={'stamps':audits,'place_triangle_changed_pixels':changed_count,
            'all_other_place_pixels_identical':True,'native_review_sizes':[24,40,64,120],
            'existing_stamps_unchanged':len(stamps),'existing_stamp_webps_unchanged':len(exports),
            'existing_art_unchanged':len(after),
            'reference_comparison':'The same curved academic-building motif in the corrected single-ring place stamp and new double-ring hunt stamp; no lettering, emblem, triangle or Red Bird.',
            'pass':True}
    (CHECKS/'hkust-stamp-audit.json').write_text(json.dumps(report,indent=2)+'\n')
    print(f'HKUST stamp PASS; {len(stamps)} old stamp PNGs, {len(exports)} old stamp WebPs, all {len(after)} old art files byte-identical')

if __name__=='__main__':main()
