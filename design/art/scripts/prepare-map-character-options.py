#!/usr/bin/env python3
"""Normalize full-body concept layout and make labeled 64/96/120 px reviews.

Only canvas placement/scale is changed; no illustration is redrawn. Optional
--sources JSON supplies the original built-in imagegen outputs on first run.
"""
import argparse
import json
import shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ART = Path(__file__).resolve().parents[1]
ROOT = ART / 'concepts/map-characters'
CHECKS = ROOT / '_checks'
PAPER = '#F6F8FB'

def font(size):
    return ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', size)

def figure(im, height):
    bbox = im.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
    im = im.crop(bbox)
    return im.resize((round(im.width * height / im.height), height), Image.Resampling.LANCZOS)

def review(options, group, title):
    sheet = Image.new('RGB', (1200, 735), PAPER)
    d = ImageDraw.Draw(sheet)
    d.text((28, 17), title, fill='#16263F', font=font(29))
    for col, option in enumerate(o for o in options if o['type'] == group):
        x = col * 400
        d.rounded_rectangle((x + 12, 68, x + 388, 726), 16, fill='white', outline='#DCE8F2', width=2)
        label = option['label'].split(' — ', 1)
        d.text((x + 28, 83), label[0], fill='#6E2B3F', font=font(24))
        d.text((x + 28, 115), label[1], fill='#16263F', font=font(25))
        im = Image.open(ROOT / (option['id'] + '.png')).convert('RGBA')
        large = figure(im, 360)
        sheet.paste(large, (x + (400-large.width)//2, 155), large)
        d.line((x + 35, 535, x + 365, 535), fill='#DCE8F2')
        for height, cx in ((64, 80), (96, 190), (120, 310)):
            small = figure(im, height)
            sheet.paste(small, (x + cx-small.width//2, 678-height), small)
            d.text((x + cx-23, 690), f'{height}px', fill='#2F5D8A', font=font(16))
    sheet.save(CHECKS / (group + '-options.png'), optimize=True)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--sources', type=Path)
    args = parser.parse_args()
    CHECKS.mkdir(parents=True, exist_ok=True)
    if args.sources:
        for source in json.loads(args.sources.read_text()):
            shutil.copy2(source['source'], CHECKS / ('source-' + source['id'] + '.png'))
    config = json.loads((ROOT / 'prompts.json').read_text())
    reports = []
    for option in config['options']:
        im = Image.open(CHECKS / ('source-' + option['id'] + '.png')).convert('RGBA')
        source_size = list(im.size)
        source_bbox = im.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
        sprite = figure(im, 744)
        assert sprite.width < 800
        master = Image.new('RGBA', (1024, 1024))
        master.alpha_composite(sprite, ((1024-sprite.width)//2, 156))
        master.save(ROOT / (option['id'] + '.png'), optimize=True)
        alpha = master.getchannel('A')
        corners = [alpha.getpixel(p) for p in ((0,0),(1023,0),(0,1023),(1023,1023))]
        assert corners == [0,0,0,0]
        assert alpha.getbbox()[3] == 900
        reports.append({'id': option['id'], 'canvas': [1024,1024], 'source_size': source_size,
                        'source_bbox': source_bbox, 'visible_bbox': list(alpha.getbbox()),
                        'map_anchor': {'x':512,'y':900}, 'corners_alpha':corners,
                        'review_heights_px':[64,96,120], 'pass':True})
    (CHECKS / 'checks.json').write_text(json.dumps(reports, indent=2)+'\n')
    review(config['options'], 'npc', 'HUMAN NPC MAP CHARACTERS — three options')
    review(config['options'], 'player', 'PLAYER MAP CHARACTERS — three outfit options')
    # Static review only. Existing map pixels/geography are copied unchanged.
    screenshot = Image.open(ART / 'reference/catch-background/map-now.jpg').convert('RGB')
    background = screenshot.crop((0,950,380,1270))
    sheet = Image.new('RGB', (1200,850), PAPER)
    d = ImageDraw.Draw(sheet)
    d.text((24,15), 'MAP-SIZE COMPARISON — each figure 120px tall', fill='#16263F', font=font(27))
    for index, option in enumerate(config['options']):
        x,y=(index%3)*400+10,60+(index//3)*390
        sheet.paste(background,(x,y))
        d.ellipse((x+180,y+244,x+220,y+254),fill='#C1BBAF')
        sprite=figure(Image.open(ROOT/(option['id']+'.png')).convert('RGBA'),120)
        sheet.paste(sprite,(x+200-sprite.width//2,y+250-120),sprite)
        d.text((x+10,y+332),option['label'],fill='#16263F',font=font(20))
    sheet.save(CHECKS/'map-size-review.png',optimize=True)
    print('6/6 full-body concepts: canvas, alpha, common foot baseline PASS; 64/96/120px sheets saved')

if __name__ == '__main__':
    main()
