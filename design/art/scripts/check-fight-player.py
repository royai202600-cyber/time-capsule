#!/usr/bin/env python3
"""Check the resting fight stack and render art review sheets at game sizes."""

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
CHECKS = ROOT / '_checks'
PAPER = '#F6F8FB'
NAVY = '#16263F'
ARIAL = Path('/System/Library/Fonts/Supplemental/Arial.ttf')
FONT = ImageFont.truetype(ARIAL, 12) if ARIAL.exists() else ImageFont.load_default(size=12)
POSES = (
    ('Idle', {}),
    ('Gather power', {'arm': -36}),
    ('Draw back −60°', {'arm': -60}),
    ('Follow-through +70°', {'arm': 70}),
    ('Side-step ±8°', {'leg-left': 8, 'leg-right': -8}),
    ('Jump tuck', {'arm': -26, 'leg-left': -22, 'leg-right': -30}),
)


def master(path):
    return Image.open(ROOT / path).convert('RGBA')


def label(draw, x, y, text):
    draw.text((x, y), text, anchor='mt', fill=NAVY, font=FONT)


def check_connected(image, label_text):
    """Measure connectivity on alpha so a thin anti-aliased edge cannot bridge a joint."""
    alpha = image.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
    # Rotation and resampling can create isolated edge pixels. Ignore those.
    while bounds := alpha.getbbox():
        row = alpha.crop((bounds[0], bounds[1], bounds[2], bounds[1] + 1))
        seed = row.getbbox()
        ImageDraw.floodfill(alpha, (bounds[0] + seed[0], bounds[1]), 128)
        remaining = alpha.point(lambda a: 255 if a == 255 else 0)
        count = alpha.histogram()[128]
        if count > 64:
            assert remaining.histogram()[255] < 65, f'Detached joint in {label_text}'
            return
        alpha = remaining
    raise AssertionError(f'Empty pose {label_text}')


def main():
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    entries = {item['path'].removeprefix('design/art/'): item for item in manifest}
    fight = entries['characters/fight-01.png']
    order = fight['layer_order']
    parts = {name: master(f'characters/fight-01-{name}.png') for name in order}
    assembled = master('characters/fight-01.png')

    def pose(angles):
        result = Image.new('RGBA', assembled.size)
        for name in order:
            part = parts[name]
            if angle := angles.get(name):
                pivot = fight['pivots'][name]
                # Pose angles are clockwise on screen. Pillow rotates counterclockwise.
                part = part.rotate(-angle, Image.Resampling.BICUBIC, center=(pivot['x'], pivot['y']))
            result.alpha_composite(part)
        return result

    stack = pose({})
    assert stack.tobytes() == assembled.tobytes(), 'The 1024 px resting stack differs'
    alpha = assembled.getchannel('A').point(lambda a: 255 if a >= 16 else 0)
    left = alpha.crop((0, 850, 512, 930)).getbbox()
    right = alpha.crop((512, 850, 1024, 930)).getbbox()
    assert left and right and all(897 <= 850 + shoe[3] <= 903 for shoe in (left, right))
    assert abs(((left[0] + right[2] + 512) / 2) - 512) <= 2, 'Feet are off the shared x anchor'
    figure_bounds = alpha.getbbox()
    height = figure_bounds[3] - figure_bounds[1]
    map_reference = entries['characters/figure-01.png']
    assert fight['anchor'] == map_reference['anchor'] == {'x': 512, 'y': 900}
    assert fight['shared_scale'] == map_reference['shared_scale'] == 0.6715063520871143
    reference_alpha = master('characters/figure-01.png').getchannel('A')
    reference_bounds = reference_alpha.point(lambda a: 255 if a >= 16 else 0).getbbox()
    assert abs(height - (reference_bounds[3] - reference_bounds[1])) <= 3, 'Adult figure scale drifted'

    def at_height(frame, height_px):
        canvas_edge = round(frame.width * height_px / height)
        return frame.resize((canvas_edge, canvas_edge), Image.Resampling.LANCZOS)

    frames = [('Master', assembled), *((title, pose(angles)) for title, angles in POSES)]
    for title, frame in frames:
        check_connected(frame, title)
        bounds = frame.getbbox()
        assert 0 < bounds[0] < bounds[2] < frame.width
        assert 0 < bounds[1] < bounds[3] < frame.height
    assert at_height(stack, 120).tobytes() == at_height(assembled, 120).tobytes()
    sheet = Image.new('RGBA', (884, 314), PAPER)
    draw = ImageDraw.Draw(sheet)
    label(draw, 442, 9, 'Fight player 01 • resting master and rotated parts')
    for idx, (title, frame) in enumerate(frames):
        center = 78 + idx * 123
        label(draw, center, 32, title)
        for height_px, top, line in ((120, 52, 198), (64, 220, 299)):
            preview = at_height(frame, height_px)
            if title == 'Jump tuck':
                top -= round(height_px * .075)
            sheet.alpha_composite(preview, (center-preview.width//2, top-round(figure_bounds[1]*height_px/height)))
            label(draw, center, line, f'{height_px} px')
    sheet.convert('RGB').save(CHECKS / 'fight-01-motion.png', optimize=True)

    skins = (('Wax', 'wax'), ('Gold', 'gold'), ('Ink', 'ink'), ('Plum', 'plum'), ('Brass', 'brass'))
    wax = master('game/ball-wax.png')
    wax_alpha = wax.getchannel('A')
    bound = wax_alpha.getbbox()
    review = Image.new('RGBA', (715, 259), PAPER)
    draw = ImageDraw.Draw(review)
    label(draw, 357, 9, 'Wax-ball skins • original wax and gold at left')
    for idx, (title, skin) in enumerate(skins):
        ball = master(f'game/ball-{skin}.png')
        if skin not in ('wax', 'gold'):
            assert ball.getchannel('A').tobytes() == wax_alpha.tobytes(), f'Ball outline differs: {skin}'
            assert ImageChops.difference(ball.convert('RGB'), wax.convert('RGB')).getbbox()
        center = 72 + idx * 142
        label(draw, center, 35, title)
        for size, top in ((120, 57), (40, 197)):
            thumb = ball.crop(bound)
            thumb.thumbnail((size, size), Image.Resampling.LANCZOS)
            review.alpha_composite(thumb, (center-thumb.width//2, top))
            label(draw, center, top+size+7, f'{size} px')
    review.convert('RGB').save(CHECKS / 'fight-wax-skins.png', optimize=True)

    added = [f'characters/fight-01{suffix}.png' for suffix in ('', *(f'-{part}' for part in order))]
    added.extend(f'game/ball-{skin}.png' for _, skin in skins[2:])
    for path in added:
        exported = Image.open(REPO / entries[path]['web_export'])
        assert exported.format == 'WEBP' and exported.mode == 'RGBA' and exported.size == (512, 512), path
        assert all(exported.getpixel(p)[3] == 0 for p in ((0, 0), (511, 0), (0, 511), (511, 511))), path
    print(f'Exact 1024/120 px rest stack, {height} px standing height, {len(POSES)} connected poses,'
          f' exact skin silhouettes and {len(added)} alpha WebPs passed.')


if __name__ == '__main__':
    main()
