#!/usr/bin/env python3
"""Technical checks for Roy's unchanged Option 3; no image generation or design review."""
from io import BytesIO
from pathlib import Path
import hashlib
import importlib.util
import json
import shutil
import subprocess
import tempfile
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[3]
CHECKS = ROOT / 'design/art/_checks'
BASE = '0357ba6ba7e298251be05084e9da2a62757a55f2'
PICK = '6acd9e32a391b0c35a3b0730f15e40be42a425fe'
REF = 'b5f584d7e04681af8eaf613cdc55aa7fd8350dad'
MASTER = 'design/art/game/catch-background.png'
SOURCE = 'design/art/game/catch-background-options/option-3.png'
EXPORT = 'public/art/game/catch-background.webp'
SCREEN = 'design/art/reference/catch-background/fight-scene-now.jpg'
ALLOWED_EXISTING = {'AGENTS.md', 'design/art/README.md',
    'design/art/manifest.json', 'design/art/scripts/export-webp.cjs'}

def git_bytes(ref, path):
    return subprocess.check_output(['git','show',f'{ref}:{path}'],cwd=ROOT)

def main():
    source = git_bytes(PICK,SOURCE)
    assert (ROOT/MASTER).read_bytes() == source == (ROOT/SOURCE).read_bytes()
    for name in ('option-1.png','option-2.png'):
        assert not (ROOT/'design/art/game/catch-background-options'/name).exists()
    master = Image.open(ROOT/MASTER).convert('RGBA')
    export = Image.open(ROOT/EXPORT).convert('RGBA')
    assert master.size == export.size == (1024,1536)
    assert master.getchannel('A').getextrema() == export.getchannel('A').getextrema() == (255,255)
    assert master.getchannel('A').tobytes() == export.getchannel('A').tobytes()
    batch = json.loads((CHECKS/'catch-background-prompts.json').read_text())
    selection = batch['selection']
    style = (ROOT/'design/art/STYLE.md').read_text().split('```\n')[1].split('\n```')[0].rstrip()
    assert selection['prompt'].startswith(style+'\n')
    assert selection['prompt_verified_against_generation_record']
    assert selection['model'] == 'gpt-image-2'
    assert selection['references'] == ['design/art/style-sheet.png',SCREEN,
        'design/art/reference/catch-background/map-now.jpg']
    manifest = json.loads((ROOT/'design/art/manifest.json').read_text())
    original_manifest = json.loads(git_bytes(BASE,'design/art/manifest.json'))
    assert manifest[:-1] == original_manifest
    entry = manifest[-1]
    assert entry['path'] == MASTER and entry['web_export'] == EXPORT
    assert entry['prompt'] == selection['prompt'] and entry['references'] == selection['references']
    assert entry['source']['sha256'] == hashlib.sha256(source).hexdigest()
    exporter = (ROOT/'design/art/scripts/export-webp.cjs').read_text()
    exception = "  if (relativePath === 'game/catch-background.png') return null;\n"
    assert exporter.count(exception) == 1
    assert exporter.replace(exception,'') == git_bytes(BASE,'design/art/scripts/export-webp.cjs').decode()

    # Run the actual STYLE.md asset checker against this asset only, with the explicitly
    # approved portrait-size and opaque-background overrides in memory. Do not change the
    # shared checker or its shared audit, or rerun unrelated asset/export recipes.
    spec = importlib.util.spec_from_file_location('style_asset_check',ROOT/'design/art/scripts/check-assets.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with tempfile.TemporaryDirectory(prefix='timecapsule-catch-check-') as tmp:
        temp = Path(tmp)
        (temp/'game').mkdir()
        (temp/'_checks').mkdir()
        shutil.copyfile(ROOT/MASTER,temp/'game/catch-background.png')
        module.ROOT = temp
        module.OPAQUE = module.OPAQUE | {'game/catch-background.png'}
        original_size = module.expected_size
        module.expected_size = lambda rel: (1024,1536) if rel == 'game/catch-background.png' else original_size(rel)
        module.main()
        style_report = json.loads((temp/'_checks/assets.json').read_text())
        assert style_report['passed'] == style_report['count'] == 1
        (CHECKS/'catch-background-style-check.json').write_text(json.dumps(style_report,indent=2)+'\n')

    rows = subprocess.check_output(['git','ls-tree','-r','--full-tree',BASE],cwd=ROOT).decode().splitlines()
    protected = [(row.split('\t',1)[1],row.split('\t',1)[0].split()[2]) for row in rows
        if row.split('\t',1)[1] not in ALLOWED_EXISTING]
    hashes = subprocess.check_output(['git','hash-object','--stdin-paths'],cwd=ROOT,
        input=('\n'.join(path for path,_ in protected)+'\n').encode()).decode().splitlines()
    assert len(hashes) == len(protected)
    for (path,expected),actual in zip(protected,hashes): assert actual == expected,path
    old_agents = git_bytes(BASE,'AGENTS.md').decode()
    lines = (ROOT/'AGENTS.md').read_text().splitlines(keepends=True)
    additions = [line for line in lines if line.startswith('- 2026-11-09: Roy chose PR #84 Option 3 as-is')]
    assert len(additions) == 1
    assert ''.join(line for line in lines if line not in additions) == old_agents

    current = Image.open(BytesIO(git_bytes(REF,SCREEN))).convert('RGB')
    sheet = Image.new('RGB',(822,936),'#F6F8FB')
    font_path = '/System/Library/Fonts/Supplemental/Arial.ttf'
    if not Path(font_path).exists(): font_path = 'DejaVuSans.ttf'
    font = ImageFont.truetype(font_path,24)
    title = ImageFont.truetype(font_path,30)
    draw = ImageDraw.Draw(sheet)
    draw.text((24,12),'Time Capsule: Roy chose Option 3',font=title,fill='#16263F')
    for i,(label,im) in enumerate([('Current reference',current),('Chosen Option 3',master.convert('RGB'))]):
        x = 24+i*399
        draw.text((x,60),label,font=font,fill='#16263F')
        thumb = ImageOps.fit(im,(375,812),method=Image.Resampling.LANCZOS,centering=(.5,.5))
        sheet.paste(thumb,(x,100))
    sheet.save(CHECKS/'catch-background-options.png')
    report = {'base_commit':BASE,'source_commit':PICK,'source_path':SOURCE,
        'roy_pick':3,'master':MASTER,'web_export':EXPORT,'size_px':[1024,1536],
        'opaque':True,'source_master_sha256':hashlib.sha256(source).hexdigest(),
        'master_byte_identical_to_approved_option':True,'webp_full_resolution':True,
        'webp_alpha_exact':True,'unchosen_option_files_removed':True,
        'exact_prompt_verified_against_generation_record':selection['generation_id'],
        'style_checker_passed':True,'existing_manifest_entries_unchanged':len(original_manifest),
        'protected_existing_files_byte_identical':len(protected),
        'exporter_exception_changes_only_selected_file':True,
        'reference_commit':REF,'references':selection['references'],'phone_crop_px':[375,812],
        'design_review':'Roy approved Option 3 as-is. No redraw, extra trees, generation or further design review.'}
    (CHECKS/'catch-background-audit.json').write_text(json.dumps(report,indent=2)+'\n')
    print(f'Approved bytes exact; 1024×1536 opaque master/WebP; {len(protected)} protected files unchanged; {len(original_manifest)} prior manifest entries unchanged.')

if __name__ == '__main__':
    main()
