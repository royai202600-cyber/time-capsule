#!/usr/bin/env python3
"""Register and review only the sixteen final Time Capsule game assets."""
from io import BytesIO
from pathlib import Path
import hashlib
import json
import re
import subprocess
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ART = Path(__file__).resolve().parents[1]
ROOT = ART.parents[1]
CHECKS = ART / '_checks'
SOURCE = '8ad4ed94f59ecd72b7dc8071ee4a965bb580af1d'
BASE = 'b146b94c1199aba787d5de9edb3cb0c6f880e2f3'
CONCEPT = 'design/art/concepts/time-capsule-game/'
LAND = (243, 239, 230, 255)
PAPER = (246, 248, 251, 255)
BRASS = (201, 161, 90, 255)
COPIES = {
    'game/ball-gold.png': 'ball/ball-keyhole-gold.png',
    'game/waypost-gem.png': 'waypost/waypost-gem-purple.png',
    'game/landmark-gem.png': 'waypost/landmark-gem-deep-purple.png',
    'game/crack-overlay.png': 'cracks/crack-a-large.png',
    'game/hit-dust.png': 'screens/hit-dust.png',
    'portraits/portrait-passerby.png': 'whoever/portrait-a-bench.png',
    'scenes/scene-passerby-sealed.png': 'whoever/scene-a-bench.png',
    **{f'game/wheel/scene-{name}.png': f'wheel/scene-{name}.png' for name in
       ('park', 'garden', 'waterfront', 'public-art', 'landmark-singapore', 'landmark-macau')},
}
LABELS = {
    'game/ball-wax.png': 'Wax keyhole ball',
    'game/ball-gold.png': 'Gold-veined keyhole ball',
    'game/waypost-gem.png': 'Floating purple Waypost',
    'game/landmark-gem.png': 'Floating Landmark Waypost',
    'game/crack-overlay.png': 'Crack A overlay',
    'game/hit-dust.png': 'Wax and brass hit dust',
    'portraits/portrait-passerby.png': 'Passerby: envelope on a bench',
    'scenes/scene-passerby-sealed.png': 'Passerby: sealed bench scene',
    **{f'game/wheel/scene-{name}.png': label for name, label in (
        ('park', 'Park'), ('garden', 'Garden'), ('waterfront', 'Waterfront'),
        ('square', 'Square: shophouses'), ('public-art', 'Public art'),
        ('landmark-taipei', 'Landmark: Taipei'),
        ('landmark-singapore', 'Landmark: Singapore'), ('landmark-macau', 'Landmark: Macau'))},
}
WHEELS = [p for p in LABELS if p.startswith('game/wheel/')]
EDIT_POLYGONS = {
    'scene-landmark-taipei': [
        [(0,678),(425,678),(428,867),(0,867)],
        [(607,678),(1023,678),(1023,867),(600,867)]],
    'scene-square': [
        [(0,250),(170,250),(170,330),(250,360),(350,360),(390,600),(390,745),(0,745)],
        [(625,745),(625,570),(700,500),(710,400),(840,320),(930,280),(1023,280),(1023,745)]],
}

def git_bytes(ref, path):
    return subprocess.check_output(['git', 'show', f'{ref}:{path}'], cwd=ROOT)

def load(path):
    return Image.open(ART / path).convert('RGBA')

def visible(im):
    return im.getchannel('A').point(lambda v: 255 if v >= 16 else 0).getbbox()

def fit(im, size):
    im = im.copy()
    im.thumbnail((size, size), Image.Resampling.LANCZOS)
    return im

def circle(path, size):
    edge = size * 4
    im = load(path).resize((edge, edge), Image.Resampling.LANCZOS)
    mask = Image.new('L', (edge, edge))
    ImageDraw.Draw(mask).ellipse((0, 0, edge-1, edge-1), fill=255)
    im.putalpha(mask)
    ImageDraw.Draw(im).ellipse((0, 0, edge-1, edge-1), outline=BRASS, width=12)
    return im.resize((size, size), Image.Resampling.LANCZOS)

def section(readme, path):
    match = re.search(r'^#{3,4} `' + re.escape(path) + r'`\s*$', readme, re.M)
    if not match:
        raise ValueError(f'Missing source prompt: {path}')
    text = readme[match.end():].split('```text\n', 1)[1].split('\n```', 1)[0]
    header = readme[match.end():].split('```text', 1)[0]
    refs = re.findall(r'`(design/art/[^`]+)`', header)
    return text, refs

def entries():
    readme = git_bytes(SOURCE, CONCEPT + 'README.md').decode()
    generated = {r['path']: r for r in json.loads((CHECKS / 'game-final-generation.json').read_text())}
    records = []
    for rel, label in LABELS.items():
        im = load(rel)
        record = {'path': 'design/art/' + rel, 'what': label, 'size_px': list(im.size),
                  'transparent': im.getchannel('A').getextrema()[0] < 255,
                  'model': 'gpt-image-2', 'web_export': 'public/art/' + rel[:-4] + '.webp'}
        if rel in COPIES:
            src = COPIES[rel]
            prompt_src = {
                'waypost/waypost-gem-purple.png': 'waypost/landmark-a-gem.png',
                'waypost/landmark-gem-deep-purple.png': 'waypost/landmark-a-gem.png',
                'cracks/crack-a-large.png': 'cracks/crack-a-large-raw.png',
            }.get(src, src)
            record['prompt'], record['references'] = section(readme, prompt_src)
            record['source'] = {'commit': SOURCE, 'path': CONCEPT + src,
                                'sha256': hashlib.sha256(git_bytes(SOURCE, CONCEPT + src)).hexdigest()}
            record['postprocess'] = 'Exact byte copy of Roy-approved concept master; no redraw, resave or new processing.'
            if 'gem' in rel:
                record['source_processing'] = 'Approved source derivation: remove pole/dot at clean facet point, compress each gem to 50% width at unchanged height; Landmark RGB multiplied by 0.8. No pole or shadow.'
            if rel == 'game/crack-overlay.png':
                record['source_processing'] = 'Approved navy crack pattern converted to a transparent overlay; inherited top-left alpha is 238. Preserved exactly as requested.'
        else:
            record.update(generated['design/art/' + rel])
            record['source_commit'] = SOURCE
            if rel == 'game/ball-wax.png':
                record['postprocess'] = 'Generated 1254 square. Crop at alpha >=16 and downsample to the gold ball visible bounds (152,141)-(871,876), then paste on a transparent 1024 square. No upscaling. Native alpha retained inside the crop.'
            else:
                name = Path(rel).stem
                record['postprocess'] = 'Generated 1254 square downsampled to 1024. Composite only building edit regions over the approved concept, retaining all pixels outside the masks, including original tower/lamp and ground/paving. Polygon edges feathered by 1.5 px.'
                record['edit_polygons_px'] = json.loads(json.dumps(EDIT_POLYGONS[name]))
        if 'gem' in rel:
            record['alpha_bbox_px'] = list(im.getchannel('A').getbbox())
        records.append(record)
    return records

def register(records):
    path = ART / 'manifest.json'
    raw = path.read_text()
    current = json.loads(raw)
    known = {r['path']: r for r in current}
    new = []
    for record in records:
        if record['path'] in known:
            assert known[record['path']] == record, record['path']
        else:
            new.append(record)
    if new:
        assert raw.endswith('\n]\n')
        addition = ',\n'.join('  ' + json.dumps(r, ensure_ascii=False, indent=2).replace('\n', '\n  ') for r in new)
        path.write_text(raw[:-3] + ',\n' + addition + '\n]\n')
    baseline = json.loads(git_bytes(BASE, 'design/art/manifest.json'))
    assert json.loads(path.read_text())[:len(baseline)] == baseline

def review_images():
    sizes = Image.new('RGBA', (800, 540), LAND)
    for rel, cx in (('game/ball-wax.png', 80), ('game/ball-gold.png', 200)):
        im = fit(load(rel).crop(visible(load(rel))), 64)
        sizes.alpha_composite(im, (cx-im.width//2, 30))
    for rel, x in (('game/waypost-gem.png', 320), ('game/landmark-gem.png', 550)):
        for offset, edge in ((0, 48), (90, 64)):
            im = fit(load(rel).crop(visible(load(rel))), edge)
            sizes.alpha_composite(im, (x+offset-im.width//2, 30))
    for i, path in enumerate(WHEELS):
        sizes.alpha_composite(circle(path, 96), (52+(i%4)*200, 155+(i//4)*145))
    for x, edge in ((310, 24), (430, 40)):
        sizes.alpha_composite(load('portraits/portrait-passerby.png').resize((edge,edge),Image.Resampling.LANCZOS),(x,475))
    sizes.convert('RGB').save(CHECKS / 'game-final-sizes.png')
    font_path = '/System/Library/Fonts/Supplemental/Arial.ttf'
    if not Path(font_path).exists():
        font_path = 'DejaVuSans.ttf'
    font = ImageFont.truetype(font_path, 23)
    sheet = Image.new('RGBA', (1920, 1920), PAPER)
    draw = ImageDraw.Draw(sheet)
    for i, (path, label) in enumerate(LABELS.items()):
        im = load(path)
        if path.startswith('game/') and not path.startswith('game/wheel/') and 'crack' not in path and 'dust' not in path:
            im = im.crop(visible(im))
        im = fit(im, 400)
        x, y = (i%4)*480, (i//4)*480
        sheet.alpha_composite(im, (x+(480-im.width)//2, y+20+(400-im.height)//2))
        draw.text((x+18,y+443),label,font=font,fill=(22,38,63))
    sheet.convert('RGB').save(CHECKS / 'game-final-contact-sheet.png')
    old = Image.open(BytesIO(git_bytes(SOURCE, CONCEPT+'ball/ball-keyhole.png'))).convert('RGBA')
    final = fit(load('game/ball-wax.png').crop(visible(load('game/ball-wax.png'))),335)
    compare = Image.new('RGBA',(760,380),LAND)
    compare.alpha_composite(old,(20,20))
    compare.alpha_composite(final,(405+(335-final.width)//2,20))
    compare.convert('RGB').save(CHECKS / 'game-final-ball-comparison.png')

def audit(records):
    issues = []
    copied = []
    for rel, src in COPIES.items():
        assert (ART/rel).read_bytes() == git_bytes(SOURCE, CONCEPT+src), rel
        copied.append(rel)
    corners = {}
    for rel in list(LABELS)[:6]:
        im = load(rel); w,h = im.size
        a = im.getchannel('A')
        values = [a.getpixel(xy) for xy in ((0,0),(w-1,0),(0,h-1),(w-1,h-1))]
        corners[rel] = values
        if any(values):
            issues.append({'path': rel, 'issue': 'Inherited nontransparent corner in required exact source copy.', 'corners_alpha': values})
            assert rel == 'game/crack-overlay.png' and values == [238,0,0,0]
    for rel in WHEELS:
        im = load(rel)
        assert im.size == (1024,1024) and im.getchannel('A').getextrema() == (255,255)
    for name, polygons in EDIT_POLYGONS.items():
        old = Image.open(BytesIO(git_bytes(SOURCE, CONCEPT+f'wheel/{name}.png'))).convert('RGB')
        new = load(f'game/wheel/{name}.png').convert('RGB')
        mask = Image.new('L', (1024,1024)); draw = ImageDraw.Draw(mask)
        for polygon in polygons: draw.polygon(polygon,fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(1.5))
        protected = mask.point(lambda v:255 if v==0 else 0)
        diff = ImageChops.difference(old,new)
        assert all(ImageChops.multiply(c,protected).getbbox() is None for c in diff.split()), name
    report = {'source_commit': SOURCE, 'base_commit': BASE, 'copied_masters_exact': copied,
              'opaque_wheel_scenes': WHEELS, 'corners_alpha': corners,
              'existing_manifest_entries_unchanged': True,
              'scene_pixels_outside_edit_masks_unchanged': True,
              'gem_bounding_boxes': {r['path']:r['alpha_bbox_px'] for r in records if 'alpha_bbox_px' in r},
              'issues': issues}
    (CHECKS/'game-final-audit.json').write_text(json.dumps(report,indent=2)+'\n')
    print(f'13/13 approved master copies exact; 8/8 wheels opaque; manifest preserved; {len(issues)} inherited corner issue recorded.')

if __name__ == '__main__':
    records = entries()
    register(records)
    review_images()
    audit(records)
