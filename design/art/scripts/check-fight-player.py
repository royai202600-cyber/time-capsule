#!/usr/bin/env python3
"""Audit the figure 01 rig and render the art review sheets."""

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps

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


def assert_joint(image, name, box, core):
    """Check that each joint core is solid and the surrounding seam has no enclosed gap."""
    alpha = image.getchannel('A')
    assert alpha.crop(core).getextrema()[0] >= 245, f'{name}: translucent joint center'
    exterior = alpha.point(lambda a: 255 if a >= 160 else 0)
    ImageDraw.floodfill(exterior, (0, 0), 128)
    assert exterior.crop(box).histogram()[0] == 0, f'{name}: enclosed gap in joint'


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


def main():
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    entries = {item['path'].removeprefix('design/art/'): item for item in manifest}
    prefix = 'characters/fight-01'
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
    reference = entries['characters/figure-01.png']
    assert fight['anchor'] == reference['anchor'] == {'x': 512, 'y': 900}
    assert fight['shared_scale'] == reference['shared_scale'] == 0.6715063520871143
    height = fight['anchor']['y'] - fight['crown_y_px']
    assert abs(height - reference['standing_height_px']) <= 5
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
    label(draw, 400, 9, 'Fight player 01 at standing display scale')
    label(zoom_draw, 470, 9, 'Fight player 01 · magnified shoulder and hip seams')
    for idx, (title, frame) in enumerate(frames):
        assert_joint(frame, f'{title} shoulder', (544, 361, 633, 450), (552, 382, 574, 409))
        assert_joint(frame, f'{title} hips', (452, 531, 579, 590), (468, 539, 552, 574))
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
            ((524, 338, 662, 471), 56, 'Shoulder'),
            ((427, 514, 600, 645), 243, 'Hips'),
        ):
            patch = frame.crop(crop)
            patch = ImageOps.contain(patch, (164, 148), Image.Resampling.LANCZOS)
            x = center - patch.width // 2
            zoom_draw.rectangle((center-87, y, center+87, y+150), fill='#DCE8F2')
            seams.alpha_composite(patch, (x, y+(150-patch.height)//2))
            label(zoom_draw, center, y+155, name)

    motion.convert('RGB').save(CHECKS / 'fight-01-motion.png', optimize=True)
    seams.convert('RGB').save(CHECKS / 'fight-01-seams.png', optimize=True)
    check_skins()

    paths = [f'{prefix}.png', *(f'{prefix}-{part}.png' for part in parts)]
    paths += [f'game/ball-{skin}.png' for skin in ('ink', 'plum', 'brass')]
    for path in paths:
        exported = Image.open(REPO / entries[path]['web_export'])
        assert exported.format == 'WEBP' and exported.mode == 'RGBA' and exported.size == (512, 512), path
        assert all(exported.getpixel(p)[3] == 0 for p in ((0, 0), (511, 0), (0, 511), (511, 511))), path
    print(f'Exact 1024/120 px gathering stack, five shoulder/hip seam checks, '
          f'exact skin silhouettes and {len(paths)} alpha WebPs passed.')


if __name__ == '__main__':
    main()
