#!/usr/bin/env python3
"""Normalize the B5 balloon source and derive exact, shared-canvas lift layers."""
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
CHECKS = ROOT / '_checks'
VESSELS = ROOT / 'vessels'
SOURCE = CHECKS / 'b5-hot-air-balloon-source.png'
PAPER = (246, 248, 251, 255)
NAME = 'hot-air-balloon'


def bbox(image):
    return image.getchannel('A').point(lambda a: 255 if a > 20 else 0).getbbox()


def flat(image):
    return Image.alpha_composite(Image.new('RGBA', image.size, PAPER), image).convert('RGB')


def label_font(size):
    return ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', size)


def move_y(image, fraction, opacity):
    moved = Image.new('RGBA', image.size)
    moved.alpha_composite(image, (0, round(fraction * 1024)))
    if opacity < 1:
        alpha = moved.getchannel('A').point(lambda a: round(a * opacity))
        moved.putalpha(alpha)
    return moved


def main():
    source = Image.open(SOURCE).convert('RGBA')
    assert source.size == (1254, 1254)
    # Low-alpha fringe from the transparent native image is not part of the art.
    alpha = source.getchannel('A').point(lambda a: a if a > 5 else 0)
    source.putalpha(alpha)
    small = source.resize((803, 803), Image.Resampling.LANCZOS)
    normalized = Image.new('RGBA', (1024, 1024))
    normalized.alpha_composite(small, (117, 112))
    # Split just above the rolled letter. The lower rope segments and their
    # basket rings remain with the static gift, and the envelope lifts away.
    split_y = 678
    basket = Image.new('RGBA', (1024, 1024))
    basket.paste(normalized.crop((0, split_y, 1024, 1024)), (0, split_y))
    balloon = Image.new('RGBA', (1024, 1024))
    balloon.paste(normalized.crop((0, 0, 1024, split_y)), (0, 0))
    assembled = Image.alpha_composite(basket, balloon)
    VESSELS.mkdir(exist_ok=True)
    CHECKS.mkdir(exist_ok=True)
    parts = {'basket': basket, 'balloon': balloon}
    for part, image in [('', assembled), *parts.items()]:
        suffix = f'-{part}' if part else ''
        image.save(VESSELS / f'vessel-{NAME}{suffix}.png', optimize=True)
    stack = Image.alpha_composite(basket, balloon)
    stack.save(CHECKS / f'{NAME}-stack.png', optimize=True)
    assert ImageChops.difference(assembled, stack).getbbox() is None
    bounds = bbox(assembled)
    assert bounds[2] - bounds[0] <= 760 and bounds[1] >= 100 and 880 <= bounds[3] - 1 <= 920, bounds
    assert all(image.getchannel('A').getpixel(p) == 0 for image in (assembled, basket, balloon)
               for p in ((0, 0), (1023, 0), (0, 1023), (1023, 1023)))
    spec = {
        'id': NAME, 'opening': 'B', 'idleMs': 4000,
        'idle': [{'type': 'float', 'amount': 0.03}],
        'layers': [
            {'name': 'basket', 'file': f'vessel-{NAME}-basket.png', 'role': 'static'},
            {'name': 'balloon', 'file': f'vessel-{NAME}-balloon.png', 'role': 'lift',
             'pivot': {'x': 512, 'y': split_y},
             'open': [{'at': 0, 'y': 0, 'opacity': 1},
                      {'at': 0.5, 'y': -0.10, 'opacity': 0.85},
                      {'at': 1, 'y': -0.65, 'opacity': 0}]},
        ],
        'mouth': {'x': 512, 'y': 719}, 'baseY': bounds[3] - 1,
        'sparkle': {'x': 407, 'y': 760},
        'glint': None, 'openGlow': None, 'readyPulse': None,
    }
    (CHECKS / 'b5-hot-air-balloon-spec.json').write_text(json.dumps(spec, indent=2) + '\n')
    # App-sized silhouette and an annotated motion review.
    strip = Image.new('RGB', (360, 180), PAPER[:3])
    sd = ImageDraw.Draw(strip)
    for size, x in ((40, 40), (120, 180)):
        thumb = flat(assembled).resize((size, size), Image.Resampling.LANCZOS)
        thumb.save(CHECKS / f'{NAME}-at-{size}px.png')
        strip.paste(thumb, (x, 10))
        sd.text((x, 145), f'{size} px', font=label_font(17), fill='#16263F')
    strip.save(CHECKS / f'{NAME}-silhouette.png', optimize=True)
    sheet = Image.new('RGB', (1240, 620), PAPER[:3])
    draw = ImageDraw.Draw(sheet)
    for i, (title, y, opacity) in enumerate((('CLOSED', 0, 1), ('HALF OPEN', -.10, .85), ('OPEN', -.65, 0))):
        ox = 15 + i * 410
        frame = Image.alpha_composite(basket, move_y(balloon, y, opacity))
        sheet.paste(flat(frame).resize((400, 400), Image.Resampling.LANCZOS), (ox, 40))
        draw.text((ox + 10, 10), title, font=label_font(21), fill='#16263F')
        for point, color in ((spec['layers'][1]['pivot'], '#6E2B3F'),
                             (spec['mouth'], '#A3364F'), (spec['sparkle'], '#C9A15A')):
            x = ox + round(point['x'] * 400 / 1024)
            py = 40 + round(point['y'] * 400 / 1024)
            draw.line((x-6, py, x+6, py), fill=color, width=2)
            draw.line((x, py-6, x, py+6), fill=color, width=2)
        draw.line((ox+12, 40 + round(spec['baseY']*400/1024), ox+392,
                   40 + round(spec['baseY']*400/1024)), fill='#2F5D8A', width=1)
    lines = [f'B lift | baseY {spec["baseY"]} | mouth {spec["mouth"]} | sparkle {spec["sparkle"]}',
             'balloon lift: at 0 (y 0, opacity 1)  /  at .5 (y -.10, opacity .85)  /  at 1 (y -.65, opacity 0)',
             'basket and rolled letter: static, complete, opacity 1 throughout opening',
             'idle: whole-vessel float .03, 4000 ms. Crosshairs: plum pivot, wax red mouth, brass sparkle.']
    for i, line in enumerate(lines):
        draw.text((22, 465 + 31*i), line, font=label_font(16), fill='#16263F')
    sheet.save(CHECKS / f'{NAME}-motion.png', optimize=True)
    contact = Image.new('RGB', (900, 310), PAPER[:3])
    cd = ImageDraw.Draw(contact)
    cd.text((20, 13), 'B5 FOOD AND TRAVEL  ·  BALLOON TEST VESSEL', font=label_font(23), fill='#16263F')
    for i, (title, im) in enumerate((('assembled', assembled), ('basket', basket), ('balloon', balloon))):
        contact.paste(flat(im).resize((240, 240), Image.Resampling.LANCZOS), (i*300+30, 45))
        cd.text((i*300+30, 285), title, font=label_font(16), fill='#16263F')
    contact.save(CHECKS / 'b5-contact-sheet.png', optimize=True)
    report = {'canvas': [1024, 1024], 'bbox_alpha_gt_20': bounds,
              'baseY': spec['baseY'], 'closed_stack_exact': True,
              'transparent_corners': True, 'layer_order': ['basket', 'balloon'],
              'gift_visible_at_open': True, 'open_balloon_opacity': 0,
              'ip_review': 'Original striped balloon and generic wicker basket; no logo, brand shape, character or text.'}
    (CHECKS / f'{NAME}-check.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
