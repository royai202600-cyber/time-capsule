from pathlib import Path
import json, shutil
ROOT=Path(__file__).resolve().parents[3]
STAGE=ROOT/'design/art'
STYLE='''App: 時光膠囊 / Time Capsule. People send a sealed letter that can only be opened at a set time and place. Mood: tender, human, nostalgic, "precious in the AI age". Hand-inked storybook, not glossy 3D.
- Clean ink line art with a slightly hand-drawn line, flat colour fills plus one soft shading tone, a little paper grain, light hatching only (it must still read at about 120 px). Lines in plum #6E2B3F or navy #16263F.
- Palette only: ink blue #2F5D8A, light blue #5A8FD0, glass blue #DCE8F2, plum #6E2B3F, brass #C9A15A, wax red #A3364F, navy #16263F, paper #F6F8FB, cream #F3E2BB. Warm brown wood is allowed for wooden objects.
- Front three-quarter view, soft top-left light. No text, letters, numbers, logos or real brands.
- Transparent background, object centred, generous padding (object fills about 70% of the canvas), square.
Match the attached style sheet exactly.'''
assert STYLE in (ROOT/'design/art/STYLE.md').read_text()
CLOSED='''Use case: illustration-story
Asset type: Time Capsule illustrated vessel, closed assembled master.
Input image: attached style sheet is the REQUIRED reference; match it exactly.
Primary request: An original thick leather spellbook, CLOSED and sealed, front three-quarter view. The left spine is plainly visible and is the hinge for a front cover that opens toward the left. Brass corner protectors and a small detachable brass clasp at the RIGHT edge. Emboss a simple abstract star-and-rose motif on the front cover, with no coat of arms, letterforms, or recognizable fantasy franchise iconography. Warm cream light glows narrowly from the closed page edges against dark navy leather. The book is a keepsake vessel for a letter; make its silhouette clear at 40 and 120 pixels.
Composition: one isolated object on a square transparent canvas, centered; widest point no more than about 74% of canvas, lowest pixel near 88% of canvas, at least 12% empty above. No scene or ground plane. The book remains fully closed in this assembled image.
Constraints: original design, no logos, no brand names or brand shapes, no characters, no text. No wizard-school crests, houses, owls or scarred heroes. True transparent corners and background.
'''+STYLE
REVEAL='''Use case: precise-object-edit
Asset type: Time Capsule spellbook reveal layer, same 1024-aligned vessel canvas.
Input images: Image 1 is the CLOSED spellbook edit target. Image 2 is the required style sheet reference; match its style exactly.
Primary request: Remove ONLY the dark navy FRONT COVER panel and its right-side brass clasp from Image 1, revealing the complete cream-colored first page and a small rolled paper letter lying on it. The page is fully drawn behind where the front cover was, so it remains visible once the cover swings away. Retain the book's existing left spine, top and right page edges, rear board, brass corner on the rear board, line style, pose, position, scale, lighting, colors, transparent background, and canvas exactly. This is the stationary bottom layer of a separable animation; no front cover or clasp remains visible.
Constraints: No text or glyphs on the visible page or letter. Original design, no logos, no brand names or brand shapes, no characters, no text. No wizard-school crests, houses, owls or scarred heroes. True transparent corners and background.
'''+STYLE
files=['vessel-spellbook.png','vessel-spellbook-book.png','vessel-spellbook-glow.png','vessel-spellbook-cover.png','vessel-spellbook-clasp.png']
spec=json.loads((STAGE/'_checks/spellbook-vessel.json').read_text())
manifest_path=ROOT/'design/art/manifest.json'
manifest=json.loads(manifest_path.read_text())
manifest=[x for x in manifest if 'vessel-spellbook' not in x['path']]
for name in files:
    part=name.removeprefix('vessel-spellbook').removesuffix('.png').lstrip('-')
    what='Assembled closed spellbook vessel' if not part else f'Spellbook — {part} layer'
    prompt=REVEAL if part=='book' else CLOSED
    post='gpt-image-2 closed and reveal edits aligned on the common 1024 canvas; cover and clasp masked from the closed edit; soft glow built from page-edge light; assembled equals exact at=0 layer stack. Reproduce with design/art/scripts/finish-b6-spellbook.py.'
    entry={'path':'design/art/vessels/'+name,'what':what,'size_px':[1024,1024],'transparent':True,'prompt':prompt,'model':'gpt-image-2','postprocess':post,'web_export':'public/art/vessels/'+name.replace('.png','.webp')}
    if not part: entry['vessel']=spec
    manifest.append(entry)
manifest.sort(key=lambda x:x['path'])
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
readme_path=ROOT/'design/art/README.md'; readme=readme_path.read_text()
needle='| `vessels/vessel-snow-globe.png` | Assembled winter scene snow globe vessel | 1024×1024 | processed; see manifest |'
rows='\n'.join(f'| `vessels/{name}` | {"Assembled closed spellbook vessel" if name=="vessel-spellbook.png" else "Spellbook — "+name.removeprefix("vessel-spellbook-").removesuffix(".png")+" layer"} | 1024×1024 | processed; see manifest |' for name in sorted(files))
assert needle in readme
readme='\n'.join(line for line in readme.split('\n') if 'vessels/vessel-spellbook' not in line)
readme=readme.replace(needle,needle+'\n'+rows)
marker='## Rules and checks\n'
assert marker in readme
readme='\n'.join(line for line in readme.split('\n') if not line.startswith('- T10f B6 spellbook test:'))
readme=readme.replace(marker,marker+'\n- T10f B6 spellbook test: closed navy leather book with brass corners/clasp and an abstract star-and-rose motif, complete blank page and rolled letter beneath the front cover. The clasp fades before the cover swings from its measured left-spine pivot. Page-edge glow persists through opening; a 0.025 breathe and glow pulse animate at rest. Exact CLOSED stack, transparent corners, 40/120 px silhouettes, in-canvas open letter and [B6 contact sheet](_checks/b6-contact-sheet.png) are ready for Roy’s test-vessel review. No recognizable fantasy-franchise marks were used. The remaining nine B6 vessels wait for Roy’s OK.\n')
readme_path.write_text(readme)
tasks_path=ROOT/'docs/TASKS.md'; tasks=tasks_path.read_text()
needle='| D1 | Main-only Vercel Git deployments and production retry | Codex |'
assert needle in tasks
row='| T10f | Vessel B6 magic and milestones (art only) | Codex | Spellbook test vessel and measured 40/120 px, exact CLOSED, motion and contact-sheet review complete; branch pushed for Roy’s OK before the other nine. App wiring and catalogue migration are separate. |\n'
tasks='\n'.join(line for line in tasks.split('\n') if not line.startswith('| T10f |'))
tasks=tasks.replace(needle,row+needle)
tasks_path.write_text(tasks)
print('Registered',len(files),'spellbook PNG masters, 5 checks, manifest/README/TASKS')

(ROOT/'design/art/_checks/b6-spellbook-prompts.json').write_text(json.dumps({'closed':CLOSED,'reveal':REVEAL},ensure_ascii=False,indent=2)+'\n')
