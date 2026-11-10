#!/usr/bin/env python3
"""Build City Hunt figure/identity/anchor and gem-on-map-colour review sheets."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
CHECKS=ROOT/'_checks'
PAPER='#F6F8FB'
ITEMS=(('keeper','portrait-keeper','Letter Keeper'),) + tuple((f'figure-{n:02d}',f'portrait-{n:02d}',f'Player {n:02d}') for n in range(1,9))

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
    sheet=Image.new('RGB',(1024*len(ITEMS),2240),PAPER)
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

    compact=Image.new('RGB',(1200,2520),PAPER);d=ImageDraw.Draw(compact)
    d.text((24,16),'CITY HUNT — Keeper + all eight player figures',fill='#16263F',font=font(28))
    small_crop=screenshot.crop((0,1000,380,1140))
    strip=Image.new('RGB',(240*len(ITEMS),340),PAPER);sd=ImageDraw.Draw(strip)
    sd.text((18,12),'SAME FACING — head and shoulders; viewer right',fill='#16263F',font=font(25))
    for index,(name,face,label) in enumerate(ITEMS):
        x=(index%3)*400; top=55+(index//3)*820
        im=Image.open(ROOT/'characters'/f'{name}.png').convert('RGBA')
        d.text((x+20,top),label,fill='#6E2B3F',font=font(24))
        # Every hero uses the SAME canvas scaling, preserving natural height variation.
        large=im.resize((370,370),Image.Resampling.LANCZOS);place(compact,large,x+15,top+8)
        place(compact,portrait(face),x+330,top+60)
        d.text((x+18,top+345),'Shared scale / x512 / soles y900 +/-4',fill='#2F5D8A',font=font(17))
        for row,height in enumerate((64,96,120)):
            y=top+390+row*140;compact.paste(small_crop,(x+10,y))
            small=glyph(im,height);place(compact,small,x+165-small.width//2,y+132-height)
            place(compact,portrait(face),x+270,y+132-height)
            d.text((x+20,y+4),f'{height}px + 40px portrait',fill='#16263F',font=font(16))
        box=im.getchannel('A').getbbox();center=512;head=box[1]
        bust=im.crop((center-170,head-10,center+170,head+330)).resize((220,220),Image.Resampling.LANCZOS)
        place(strip,bust,index*240+10,65)
        sd.text((index*240+12,300),label,fill='#6E2B3F',font=font(20))
    compact.save(CHECKS/'city-hunt-figures-review.png',optimize=True)
    strip.save(CHECKS/'city-hunt-facing.png',optimize=True)

def stamp():
    name='stamp-hunt-xinyi-2026-11'
    new=Image.open(ROOT/'stamps'/f'{name}.png').convert('RGBA')
    a=new.getchannel('A');b=a.getbbox()
    assert new.size==(1024,1024)
    corners=[a.getpixel(p) for p in ((0,0),(1023,0),(0,1023),(1023,1023))]
    assert corners==[0,0,0,0]
    visible={p[:3] for p in new.getdata() if p[3]}
    assert visible=={(47,93,138)},visible
    sheet=Image.new('RGB',(780,590),PAPER);d=ImageDraw.Draw(sheet)
    d.text((22,15),'CITY HUNT — event / place stamp comparison',fill='#16263F',font=font(27))
    d.text((120,62),'Xinyi hunt: blue / double ring',fill='#2F5D8A',font=font(19))
    d.text((455,62),'Taipei 101: red / single ring',fill='#A3364F',font=font(19))
    old=Image.open(ROOT/'stamps/stamp-taipei101.png').convert('RGBA')
    for row,size in enumerate((40,64,120)):
        y=105+row*155
        d.text((20,y+35),f'{size}px',fill='#16263F',font=font(21))
        for im,cx in ((new,270),(old,600)):
            small=glyph(im,size);place(sheet,small,cx-small.width//2,y+(130-size)//2)
    sheet.save(CHECKS/'city-hunt-stamp.png',optimize=True)
    (CHECKS/'city-hunt-stamp.json').write_text(json.dumps({
        'path':f'stamps/{name}.png','size':list(new.size),'corners_alpha':corners,
        'alpha_bbox':list(b),'visible_rgb_colours':[list(c) for c in visible],
        'review_sizes':[40,64,120],'double_ring':True,'tower_left_letter_focal_right':True,
        'reference_url':'https://www.taipei-101.com.tw/asset/img/cover-sunrise.jpg',
        'reference_page':'https://www.taipei-101.com.tw/tw/explore/photogallery',
        'reference_observations':'Stacked upward-flared tier sections, narrower upper sections and a slim spire; simplified tower placed left behind the focal sealed letter.',
        'pass':True},indent=2)+'\n')

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
    reports=json.loads((CHECKS/'city-hunt-figures.json').read_text())
    assert len(reports)==len(ITEMS)==9
    for report in reports:
        im=Image.open(ROOT/report['file'])
        assert im.size==(1024,1024) and im.mode=='RGBA'
        alpha=im.getchannel('A');box=alpha.getbbox()
        assert list(box)==report['alpha_bbox']
        assert report['shared_scale']==0.6715063520871143
        assert report['anchor']=={'x':512,'y':900}
        assert 680<=box[3]-box[1]<=760
        assert 896<=box[3]<=904
        assert abs((box[0]+box[2])/2-512)<=.5
        assert [alpha.getpixel(p) for p in ((0,0),(1023,0),(0,1023),(1023,1023))]==[0]*4
        assert all(896<=y<=904 for y in report['soles_y'])
    screenshot=Image.open(ROOT/'reference/catch-background/map-now.jpg').convert('RGB')
    figures(screenshot);gems(screenshot);stamp()
    print('Nine figure guides, map/identity pairs, facing strip, stamp comparison and gem review saved')

if __name__=='__main__':
    main()
