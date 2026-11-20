#!/usr/bin/env python3
"""Audit the figure 01 rig and render the art review sheets."""

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
CHECKS = ROOT / '_checks'
PAPER = '#F6F8FB'
NAVY = '#16263F'
ORB = '#341C31'
ARIAL = Path('/System/Library/Fonts/Supplemental/Arial.ttf')
FONT = ImageFont.truetype(ARIAL, 13) if ARIAL.exists() else ImageFont.load_default(size=13)


def master(path):
    return Image.open(ROOT / path).convert('RGBA')


def label(draw, x, y, text):
    draw.text((x, y), text, anchor='mt', fill=NAVY, font=FONT)


def assert_outline(image, name, joint_cores, clearances):
    """Use the flooded exterior, plus independent joint cores, to find exposed background."""
    alpha = image.getchannel('A')
    # Threshold only to find the actual contour. Antialiasing belongs on that
    # contour. Pixels discovered inside the filled contour are tested separately.
    outside = alpha.point(lambda value: 255 if value >= 128 else 0)
    ImageDraw.floodfill(outside, (0, 0), 128)
    # Negative space between distinct limbs can be enclosed when their
    # silhouettes meet. Seed only these anatomical air paths as exterior.
    for x0, y0, x1, y1 in clearances:
        for y in range(y0, y1):
            row = outside.crop((x0, y, x1, y+1))
            zero = row.point(lambda value: 255 if value == 0 else 0).getbbox()
            while zero:
                ImageDraw.floodfill(outside, (x0+zero[0], y), 128)
                row = outside.crop((x0, y, x1, y+1))
                zero = row.point(lambda value: 255 if value == 0 else 0).getbbox()
    inside = outside.point(lambda value: 255 if value != 128 else 0)
    interior = inside.filter(ImageFilter.MinFilter(5))
    # The joint cores are defined independently of each render's alpha. This
    # catches slivers open to the exterior, which a flood alone cannot see.
    draw = ImageDraw.Draw(interior)
    for polygon in joint_cores:
        draw.polygon(polygon, fill=255)
    bad_alpha = alpha.point(lambda value: 255 if value < 128 else 0)
    gap = ImageChops.multiply(interior, bad_alpha)
    enclosed = outside.point(lambda value: 255 if value == 0 else 0)
    fully_transparent = alpha.point(lambda value: 255 if value == 0 else 0)
    gap = ImageChops.lighter(gap, ImageChops.multiply(enclosed, fully_transparent))
    assert not gap.getbbox(), f'{name}: transparent interior at {gap.getbbox()}'

    rgb = image.convert('RGB')
    for color in (PAPER, '#DCE8F2', '#FFFFFF'):
        backdrop = Image.new('RGB', image.size, color)
        difference = ImageChops.difference(rgb, backdrop)
        r, g, b = difference.split()
        max_delta = ImageChops.lighter(ImageChops.lighter(r, g), b)
        matches = max_delta.point(lambda value: 255 if value == 0 else 0)
        assert not ImageChops.multiply(interior, matches).getbbox(), f'{name}: backdrop color inside outline'


def thumbnail(ball, bounds, size):
    return ImageOps.contain(ball.crop(bounds), (size, size), Image.Resampling.LANCZOS)


def check_skins():
    wax = master('game/ball-wax.png')
    wax_alpha = wax.getchannel('A')
    bounds = wax_alpha.getbbox()
    review = Image.new('RGBA', (760, 371), PAPER)
    draw = ImageDraw.Draw(review)
    label(draw, 380, 9, 'Wax-ball skins')
    park = ImageOps.fit(master('game/catch-background.png'), (144, 76), centering=(.5, .69))
    for idx, skin in enumerate(('wax', 'gold', 'ink', 'plum', 'brass')):
        ball = master(f'game/ball-{skin}.png')
        if skin not in ('wax', 'gold'):
            assert ball.getchannel('A').tobytes() == wax_alpha.tobytes(), f'Ball outline differs: {skin}'
            assert ImageChops.difference(ball.convert('RGB'), wax.convert('RGB')).getbbox()
        center = 76 + idx * 152
        label(draw, center, 33, skin.title())
        for size, top in ((120, 53), (40, 195)):
            thumb = thumbnail(ball, bounds, size)
            review.alpha_composite(thumb, (center-thumb.width//2, top))
            label(draw, center, top+size+5, f'{size} px')
        x, y = center-72, 276
        review.alpha_composite(park, (x, y))
        review.alpha_composite(thumbnail(ball, bounds, 40), (x+22, y+18))
        draw.ellipse((x+84, y+18, x+123, y+57), fill=ORB)
    label(draw, 380, 257, '40 px on the catch background, with a dark plum attack orb')
    review.convert('RGB').save(CHECKS / 'fight-wax-skins.png', optimize=True)


def check_figure(entries, identity):
    prefix = f'characters/fight-{identity}'
    fight = entries[f'{prefix}.png']
    parts = {part: master(f'{prefix}-{part}.png') for part in (
        'leg-left', 'leg-right', 'legs-jump', 'arm-down', 'arm-up', 'body')}
    assembled = master(f'{prefix}.png')
    wax = master('game/ball-wax.png')

    def pose(pose_name, angles=None, ball=False):
        result = Image.new('RGBA', assembled.size)
        for part_name in fight['pose_layers'][pose_name]:
            part = parts[part_name]
            if angle := (angles or {}).get(part_name):
                pivot = fight['pivots'][part_name]
                # The motion spec uses screen angles. Pillow rotates counterclockwise.
                part = part.rotate(-angle, Image.Resampling.BICUBIC, center=(pivot['x'], pivot['y']))
            result.alpha_composite(part)
        if ball:
            art = thumbnail(wax, wax.getbbox(), fight['ball_diameter_preview_px'])
            point = fight['ball_point']
            result.alpha_composite(art, (point['x']-art.width//2, point['y']-art.height//2))
        return result

    gathering = pose('gather')
    assert gathering.tobytes() == assembled.tobytes(), 'The 1024 px gathering stack differs'
    assert parts['arm-up'].tobytes() != parts['arm-down'].tobytes()
    arm_up = entries[f'{prefix}-arm-up.png']
    assert arm_up['ball_point'] == fight['ball_point']
    assert arm_up['pivot'] == entries[f'{prefix}-arm-down.png']['pivot']
    point = fight['ball_point']
    assert 0 < point['y'] < fight['crown_y_px'] and point['x'] > fight['anchor']['x']

    idle = pose('idle')
    alpha = idle.getchannel('A').point(lambda a: 255 if a >= 16 else 0)
    left = alpha.crop((0, 850, 512, 930)).getbbox()
    right = alpha.crop((512, 850, 1024, 930)).getbbox()
    assert left and right and all(897 <= 850 + shoe[3] <= 903 for shoe in (left, right))
    assert abs((left[0] + right[2] + 512) / 2 - 512) <= 2, 'Feet are off the shared x anchor'
    reference = entries[f'characters/figure-{identity}.png']
    assert fight['anchor'] == reference['anchor'] == {'x': 512, 'y': 900}
    assert fight['shared_scale'] == reference['shared_scale'] == 0.6715063520871143
    height = fight['anchor']['y'] - fight['crown_y_px']
    map_alpha = master(f'characters/figure-{identity}.png').getchannel('A')
    map_bounds = map_alpha.point(lambda value: 255 if value >= 16 else 0).getbbox()
    assert abs(height - (map_bounds[3] - map_bounds[1])) <= 1
    edge = round(120 * assembled.width / height)
    assert assembled.resize((edge, edge), Image.Resampling.LANCZOS).tobytes() == gathering.resize(
        (edge, edge), Image.Resampling.LANCZOS).tobytes()
    assert parts['legs-jump'].getbbox()[3] < idle.getbbox()[3] - 80, 'Jump shoes are not tucked'

    frames = (
        ('Idle', idle),
        ('Moving ±8°', pose('idle', {'leg-left': 8, 'leg-right': -8})),
        ('Gathering', pose('gather', ball=True)),
        ('Release 25°', pose('gather', {'arm-up': -25})),
        ('Jump', pose('jump')),
    )
    motion = Image.new('RGBA', (800, 322), PAPER)
    seams = Image.new('RGBA', (940, 437), PAPER)
    draw = ImageDraw.Draw(motion)
    zoom_draw = ImageDraw.Draw(seams)
    label(draw, 400, 9, f'Fight player {identity} at standing display scale')
    label(zoom_draw, 470, 9, f'Fight player {identity} · magnified shoulder and hip seams')
    for idx, (title, frame) in enumerate(frames):
        sx, sy = fight['pivots']['arm-up'].values()
        lx, hy = fight['pivots']['leg-left'].values()
        rx = fight['pivots']['leg-right']['x']
        hip_y = fight.get('seat_core_bottom_y_px', hy + 60)
        cores = [
            ((sx-13,sy-10),(sx+6,sy-10),(sx+6,sy+15),(sx-13,sy+15)),
            ((lx-17,hy+10),(rx+13,hy+10),(rx+5,hip_y-8),((lx+rx)//2,hip_y),(lx-8,hip_y-8)),
        ]
        clearances = []
        if title in ('Idle', 'Moving ±8°', 'Jump'):
            clearances.append((rx+12, sy+64, rx+72, hy+105))
        if title == 'Release 25°':
            # Air between the head and raised arm, above the shoulder joint.
            clearances.append((475, fight['crown_y_px'], sx+50, sy-22))
        if title == 'Jump':
            clearances.append((lx-64, sy+55, lx-12, hy+56))
            # The opening between the bent shins begins below the solid seat.
            clearances.append((lx+16, hip_y+6, rx-14, hy+190))
        assert_outline(gathering if title == 'Gathering' else frame, f'{identity} {title}', cores, clearances)

        center = 80 + idx * 160
        label(draw, center, 33, title)
        for size, top in ((120, 51), (64, 220)):
            ratio = size / height
            edge = round(frame.width * ratio)
            preview = frame.resize((edge, edge), Image.Resampling.LANCZOS)
            lift = fight['jump_preview_lift_px'] if title == 'Jump' else 0
            motion.alpha_composite(preview, (center-round(512*ratio), top-round(lift*ratio)))
        label(draw, center, 207, '120 px')
        label(draw, center, 307, '64 px')

        center = 94 + idx * 188
        label(zoom_draw, center, 32, title)
        for crop, y, name in (
            ((sx-42, sy-55, sx+96, sy+78), 56, 'Shoulder'),
            ((lx-53, hy-17, rx+49, hy+114), 243, 'Hips'),
        ):
            patch = frame.crop(crop)
            patch = ImageOps.contain(patch, (164, 148), Image.Resampling.LANCZOS)
            x = center - patch.width // 2
            zoom_draw.rectangle((center-87, y, center+87, y+150), fill='#DCE8F2')
            seams.alpha_composite(patch, (x, y+(150-patch.height)//2))
            label(zoom_draw, center, y+155, name)

    motion.convert('RGB').save(CHECKS / f'fight-{identity}-motion.png', optimize=True)
    seams.convert('RGB').save(CHECKS / f'fight-{identity}-seams.png', optimize=True)
    paths = [f'{prefix}.png', *(f'{prefix}-{part}.png' for part in parts)]
    for path in paths:
        exported = Image.open(REPO / entries[path]['web_export'])
        assert exported.format == 'WEBP' and exported.mode == 'RGBA' and exported.size == (512, 512), path
        assert all(exported.getpixel(p)[3] == 0 for p in ((0, 0), (511, 0), (0, 511), (511, 511))), path
    print(f'Figure {identity}: exact 1024/120 px gathering stack, five outline checks, {len(paths)} alpha WebPs passed.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', nargs='+', metavar='ID', help='Check only the selected figure IDs.')
    args = parser.parse_args()
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    entries = {item['path'].removeprefix('design/art/'): item for item in manifest}
    for identity in args.only or [f'{n:02d}' for n in range(1, 9)]:
        check_figure(entries, identity)
    check_skins()



if __name__ == '__main__':
    main()
