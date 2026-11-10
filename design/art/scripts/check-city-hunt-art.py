#!/usr/bin/env python3
"""Build City Hunt figure/identity/anchor and gem-on-map-colour review sheets."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
CHECKS=ROOT/'_checks'
PAPER='#F6F8FB'
ITEMS=(('keeper','portrait-keeper','Letter Keeper'),('figure-01','portrait-01','Player 01'),
       ('figure-04','portrait-04','Player 04'),('figure-06','portrait-06','Player 06'))

def font(n):
    return ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',n)

def glyph(im,height):
    im=im.crop(im.getchannel('A').getbbox())
    return im.resize((round(im.width*height/im.height),height),Image.Resampling.LANCZOS)

def portrait(name):
    return Image.open(ROOT/'portraits'/f'{name}.png').convert('RGBA').crop((75,96,935,956)).resize((40,40),Image.Resampling.LANCZOS)

def place(canvas,im,x,y):
    canvas.paste(im,(x,y),im)

def figures(screenshot):
    # Native, unscaled crop: no map pixels, geography or labels are redrawn.
    crop=screenshot.crop((0,950,380,1270))
    sheet=Image.new('RGB',(4096,2240),PAPER)
    d=ImageDraw.Draw(sheet)
    d.text((24,15),'CITY HUNT — 1024px masters; shared x512 / y900 guides',fill='#16263F',font=font(34))
    for col,(name,face,label) in enumerate(ITEMS):
        x=col*1024
        d.text((x+30,60),label,fill='#6E2B3F',font=font(29))
        im=Image.open(ROOT/'characters'/f'{name}.png').convert('RGBA')
        place(sheet,im,x,100)
        d.line((x,100+900,x+1023,100+900),fill='#C9A15A',width=1)
        d.line((x+512,100,x+512,1123),fill='#C9A15A',width=1)
        d.text((x+30,1060),'1024 x 1024; no per-figure fit-to-canvas scaling',fill='#2F5D8A',font=font(21))
        for row,height in enumerate((64,96,120)):
            cx=x+322;y=1160+row*355
            sheet.paste(crop,(cx,y))
            person=glyph(im,height)
            place(sheet,person,cx+165-person.width//2,y+250-height)
            place(sheet,portrait(face),cx+260,y+250-height)
            d.text((cx,y-30),f'{height}px figure + 40px identity portrait',fill='#16263F',font=font(23))
    sheet.save(CHECKS/'city-hunt-figures.png',optimize=True)

    compact=Image.new('RGB',(1600,1160),PAPER);d=ImageDraw.Draw(compact)
    d.text((24,16),'CITY HUNT — Keeper and three identity-matched player figures',fill='#16263F',font=font(28))
    small_crop=screenshot.crop((0,1000,380,1180))
    for col,(name,face,label) in enumerate(ITEMS):
        x=400*col;im=Image.open(ROOT/'characters'/f'{name}.png').convert('RGBA')
        d.text((x+24,68),label,fill='#6E2B3F',font=font(24))
        large=im.resize((460,460),Image.Resampling.LANCZOS);place(compact,large,x-30,45)
        place(compact,portrait(face),x+320,115)
        d.text((x+24,465),'Same adult scale; soles y900 +/-4',fill='#2F5D8A',font=font(18))
        for row,height in enumerate((64,96,120)):
            y=540+row*205;compact.paste(small_crop,(x+10,y))
            small=glyph(im,height);place(compact,small,x+170-small.width//2,y+160-height)
            place(compact,portrait(face),x+270,y+160-height)
            d.text((x+20,y-25),f'{height}px + 40px portrait',fill='#16263F',font=font(18))
    compact.save(CHECKS/'city-hunt-figures-review.png',optimize=True)

def closest_sample(im,target,roi):
    crop=im.crop(roi);best=None
    for y in range(crop.height):
        for x in range(crop.width):
            rgb=crop.getpixel((x,y))[:3];dist=sum((a-b)**2 for a,b in zip(rgb,target))
            if best is None or dist<best[0]:best=(dist,rgb,(x+roi[0],y+roi[1]))
            if dist==0:return {'rgb':list(rgb),'source_pixel':list(best[2])}
    return {'rgb':list(best[1]),'source_pixel':list(best[2])}

def gems(screenshot):
    colours={
      'water':closest_sample(screenshot,(188,211,230),(190,950,550,1200)),
      'park':closest_sample(screenshot,(220,230,207),(20,300,650,1250)),
      'road':closest_sample(screenshot,(255,255,255),(40,300,650,1300))}
    names=(('waypost-gem','Common purple'),('waypost-gem-blue','Common blue'),
           ('landmark-gem','Landmark purple'),('landmark-gem-blue','Landmark blue'))
    sheet=Image.new('RGB',(1260,940),PAPER);d=ImageDraw.Draw(sheet)
    d.text((22,14),'CITY HUNT GEMS — original purple / derived blue; no added outline',fill='#16263F',font=font(26))
    for col,(name,label) in enumerate(names):d.text((230+col*250,62),label,fill='#16263F',font=font(20))
    row=0
    for terrain,entry in colours.items():
        for size in (48,64):
            y=105+row*135;row+=1
            d.text((18,y+45),f'{terrain.title()} / {size}px',fill='#16263F',font=font(21))
            d.rectangle((205,y,1250,y+126),fill=tuple(entry['rgb']))
            for col,(name,label) in enumerate(names):
                im=glyph(Image.open(ROOT/'game'/f'{name}.png').convert('RGBA'),size)
                place(sheet,im,330+250*col-im.width//2,y+65-im.height//2)
    sheet.save(CHECKS/'city-hunt-gems.png',optimize=True)
    p=CHECKS/'city-hunt-gems.json';records=json.loads(p.read_text())
    if isinstance(records,dict):records=records['gems']
    p.write_text(json.dumps({'gems':records,'map_background_samples':colours,
       'background_source':'design/art/reference/catch-background/map-now.jpg',
       'background_sha256':hashlib.sha256((ROOT/'reference/catch-background/map-now.jpg').read_bytes()).hexdigest(),
       'sample_sizes_visible_height_px':[48,64],
       'added_outline':False,'visual_review':'Blue facets remain distinguishable on water, park and road; subject to Roy review.'},indent=2)+'\n')

def main():
    screenshot=Image.open(ROOT/'reference/catch-background/map-now.jpg').convert('RGB')
    figures(screenshot);gems(screenshot)
    print('Figure guides, 64/96/120px identity pairs and 48/64px gem comparisons saved')

if __name__=='__main__':
    main()
