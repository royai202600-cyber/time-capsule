#!/usr/bin/env python3
"""Register the B5 balloon test without rewriting any other batch's art metadata."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CHECKS = ROOT / '_checks'
NAME = 'hot-air-balloon'
PROMPT = (CHECKS / 'b5-hot-air-balloon-prompt.txt').read_text().strip()
SPEC = json.loads((CHECKS / 'b5-hot-air-balloon-spec.json').read_text())
MANIFEST = ROOT / 'manifest.json'
README = ROOT / 'README.md'


def main():
    entries = json.loads(MANIFEST.read_text())
    by_path = {item['path']: item for item in entries}
    for suffix, what, processing in (
        ('', 'Assembled original hot-air balloon vessel',
         'finish-b5-balloon.py normalized the generated 1254 px image and recomposed the exact resting layer stack.'),
        ('-basket', 'Hot-air balloon — static wicker basket and rolled letter',
         'finish-b5-balloon.py isolated original pixels below the balloon split; the letter and basket stay fully visible.'),
        ('-balloon', 'Hot-air balloon — lift-off striped envelope',
         'finish-b5-balloon.py isolated original pixels above the basket split on the same 1024 px canvas.'),
    ):
        rel = f'vessels/vessel-{NAME}{suffix}.png'
        image = Image.open(ROOT / rel)
        entry = {'path': f'design/art/{rel}', 'what': what, 'size_px': list(image.size),
                 'transparent': True, 'prompt': PROMPT, 'model': 'gpt-image-2',
                 'postprocess': processing, 'web_export': f'public/art/vessels/vessel-{NAME}{suffix}.webp'}
        if not suffix:
            entry['vessel'] = SPEC
        by_path[entry['path']] = entry
    merged = sorted(by_path.values(), key=lambda item: item['path'])
    MANIFEST.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + '\n')
    text = README.read_text()
    if '- T10e B5 balloon test:' not in text:
        marker = '- T10a snow-globe test:'
        info = ('- T10e B5 balloon test: A generic striped hot-air balloon lifts and fades, leaving a complete wicker basket and rolled letter visible. The original generated pixels were normalized onto one 1024 canvas; the assembled CLOSED pose is an exact stack. `_checks/hot-air-balloon-motion.png` shows opening and measured pivot, mouth, base and sparkle; `_checks/hot-air-balloon-silhouette.png` shows 40/120 px. [B5 contact sheet](_checks/b5-contact-sheet.png). IP review found no text, characters, logos or brand shapes. Roy approved the test as shown, including the basket rope ends; the other nine B5 vessels are in progress.\n')
        text = text.replace(marker, info + marker, 1)
    if '· [B5 contact sheet]' not in text:
        text = text.replace('[Full contact sheet](_checks/contact-sheet.png)',
                            '[Full contact sheet](_checks/contact-sheet.png) · [B5 contact sheet](_checks/b5-contact-sheet.png)', 1)
    start = text.index('## Masters\n')
    end = text.index('\n## Review\n', start)
    table = ['## Masters', '', '| File | What | Size | Notes |', '|---|---|---:|---|']
    for item in merged:
        rel = item['path'].removeprefix('design/art/')
        notes = []
        if 'pivot' in item:
            notes.append(f"pivot {item['pivot']['x']},{item['pivot']['y']}")
        if 'postprocess' in item:
            notes.append('processed; see manifest')
        if not item['transparent']:
            notes.append('opaque')
        table.append(f"| `{rel}` | {item['what']} | {item['size_px'][0]}×{item['size_px'][1]} | {', '.join(notes)} |")
    README.write_text(text[:start] + '\n'.join(table) + '\n' + text[end:])
    print('B5 test manifest:', len(merged), 'entries')


if __name__ == '__main__':
    main()
