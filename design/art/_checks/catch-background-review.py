#!/usr/bin/env python3
"""Review only the three Time Capsule catch-background candidates."""
from io import BytesIO
from pathlib import Path
import hashlib
import json
import subprocess
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[3]
CHECKS = ROOT / 'design/art/_checks'
BASE = '0357ba6ba7e298251be05084e9da2a62757a55f2'
REF = 'b5f584d7e04681af8eaf613cdc55aa7fd8350dad'
SOURCE = 'design/art/reference/catch-background/fight-scene-now.jpg'

def git_bytes(ref, path):
    return subprocess.check_output(['git', 'show', f'{ref}:{path}'], cwd=ROOT)

def main():
    batch = json.loads((CHECKS/'catch-background-prompts.json').read_text())
    records = batch['outputs']
    assert len(records) == 3
    block = (ROOT/'design/art/STYLE.md').read_text().split('```\n')[1].split('\n```')[0].rstrip()
    for prompt in batch['batch_prompts']:
        assert prompt['prompt'].startswith(block+'\n')
        assert prompt['model'] == 'gpt-image-2'
        assert prompt['references'] == ['design/art/style-sheet.png', SOURCE,
            'design/art/reference/catch-background/map-now.jpg']
    panels = [('Current reference', Image.open(BytesIO(git_bytes(REF,SOURCE))).convert('RGB'))]
    assets = []
    for i, record in enumerate(records, 1):
        path = ROOT/record['path']
        im = Image.open(path).convert('RGBA')
        assert im.size == (1024,1536), path
        assert im.getchannel('A').getextrema() == (255,255), path
        assert record['model'] == 'gpt-image-2'
        panels.append((record['label'], im.convert('RGB')))
        assets.append({'path':record['path'],'size_px':list(im.size),'opaque':True,
            'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    sheet = Image.new('RGB',(1620,936),'#F6F8FB')
    font_path = '/System/Library/Fonts/Supplemental/Arial.ttf'
    if not Path(font_path).exists(): font_path = 'DejaVuSans.ttf'
    font = ImageFont.truetype(font_path,24)
    title = ImageFont.truetype(font_path,30)
    draw = ImageDraw.Draw(sheet)
    draw.text((24,12),'Time Capsule: catch background options',font=title,fill='#16263F')
    for i,(label,im) in enumerate(panels):
        # Equivalent to cover fit into a 375×812 viewport, centred on both axes.
        assert im.width >= 375 and im.height >= 812
        thumb = ImageOps.fit(im,(375,812),method=Image.Resampling.LANCZOS,centering=(.5,.5))
        x = 24+i*399
        draw.text((x,60),label,font=font,fill='#16263F')
        sheet.paste(thumb,(x,100))
    sheet.save(CHECKS/'catch-background-options.png')
    # All pre-existing files, including manifests, exports and shared sheets, must match main.
    rows = subprocess.check_output(['git','ls-tree','-r','--full-tree',BASE],cwd=ROOT).decode().splitlines()
    tracked = [(row.split('\t',1)[1],row.split('\t',1)[0].split()[2]) for row in rows]
    hashes = subprocess.check_output(['git','hash-object','--stdin-paths'],cwd=ROOT,
        input=('\n'.join(path for path,_ in tracked)+'\n').encode()).decode().splitlines()
    assert len(hashes) == len(tracked)
    for (path,expected),actual in zip(tracked,hashes): assert actual == expected,path
    refs = {p:hashlib.sha256(git_bytes(REF,p)).hexdigest() for p in (SOURCE,
        'design/art/reference/catch-background/map-now.jpg')}
    report = {'base_commit':BASE,'reference_commit':REF,'reference_sha256':refs,
        'model':'gpt-image-2','assets':assets,'phone_crop_px':[375,812],
        'crop_source_x_approx':[157.32,866.68],
        'all_existing_files_byte_identical':len(tracked),
        'production_export_created':False,'roy_pick':None,
        'design_review':'Left to Roy and Claude Code. Original first-batch outputs retained; later review-driven revisions excluded.'}
    (CHECKS/'catch-background-audit.json').write_text(json.dumps(report,indent=2)+'\n')
    print(f'3/3 opaque 1024×1536 options; {len(tracked)} pre-existing files byte-identical; 375×812 review sheet built.')

if __name__ == '__main__':
    main()
