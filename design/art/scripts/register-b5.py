#!/usr/bin/env python3
"""Merge B5 art metadata into the current manifest, preserving other batches."""
import json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parents[1];C=R/'_checks';M=R/'manifest.json';README=R/'README.md'
IDS=['hot-air-balloon','bubble-tea','dim-sum-steamer','bento','paper-cranes','heart-locket','suitcase','postbox','camp-lantern','treasure-chest']
def read(n):return json.loads((C/n).read_text())
def main():
 specs={'hot-air-balloon':read('b5-hot-air-balloon-spec.json'),**read('b5-rest-specs.json')}
 gen=read('b5-generated-prompts.json');covers=read('b5-cover-prompts.json');reveal=read('b5-reveal-prompts.json');extras=read('b5-extra-prompts.json');fix=read('b5-reveal-fixes-prompts.json');glass=read('b5-glass-prompts.json')
 balloon=(C/'b5-hot-air-balloon-prompt.txt').read_text().strip();film=read('b5-bubble-film-part-prompt.json')['prompt']
 prompts={
  'bubble-tea':{'cup':fix['bubble-tea-open']['prompt'],'lid':film},
  'dim-sum-steamer':{'steamer':reveal['dim-sum-steamer']['prompt'],'steam':extras['dim-sum-steam']['prompt'],'lid':covers['dim-sum-steamer']['prompt']},
  'bento':{'box':fix['bento-food']['prompt'],'lid':covers['bento']['prompt'],'knot':covers['bento-knot']['prompt']},
  'paper-cranes':{'jar':extras['paper-cranes']['prompt'],'lid':covers['paper-cranes']['prompt'],'glint':glass['cranes-glass']['prompt']},
  'heart-locket':{'stand':reveal['heart-locket']['prompt'],'back':reveal['heart-locket']['prompt'],'front':covers['heart-locket']['prompt']},
  'suitcase':{'case':reveal['suitcase']['prompt'],'lid':covers['suitcase']['prompt']},
  'postbox':{'box':reveal['postbox']['prompt'],'door':covers['postbox']['prompt']},
  'camp-lantern':{'backing':glass['lantern-body']['prompt'],'glow':glass['lantern-body']['prompt'],'lantern':glass['lantern-body']['prompt'],'cap':covers['camp-lantern']['prompt']},
  'treasure-chest':{'chest':reveal['treasure-chest']['prompt'],'lid':covers['treasure-chest']['prompt']}}
 source_prompts={'bubble-tea':[glass['bubble-glass']['prompt'],glass['bubble-contents']['prompt'],glass['bubble-film']['prompt']], 'paper-cranes':[glass['cranes-glass']['prompt'],glass['cranes-contents']['prompt']], 'camp-lantern':[glass['lantern-glass']['prompt']]}
 entries=read('../manifest.json');by={e['path']:e for e in entries}
 for id,spec in specs.items():
  names=['']+[l['name'] for l in spec['layers']]+(['glint'] if spec.get('glint') else [])
  for name in names:
   rel=f'vessels/vessel-{id}'+(f'-{name}' if name else '')+'.png';path='design/art/'+rel
   if id=='hot-air-balloon' and path in by:continue  # Approved balloon metadata and bytes stay fixed.
   im=Image.open(R/rel)
   e={'path':path,'what':f'{id} — {name} layer' if name else f'Assembled {id} vessel','size_px':list(im.size),'transparent':True,
      'prompt':prompts[id][name] if name else gen[id]['prompt'],'model':'gpt-image-2',
      'postprocess':'finish-b5-rest.py: fit complete edits without upscaling; common downscale and baseline; compose exact at=0 layer stack. Glass fill is marked then adjusted to 37.6% alpha with adjust-glass-alpha.py. Locket stand is isolated for pendant-only sway; lantern has still dark backing, a soft halo and persistent flame.',
      'web_export':'public/art/'+rel.removesuffix('.png')+'.webp'}
   if id in source_prompts:e['source_edit_prompts']=source_prompts[id]
   if not name:e['vessel']=spec
   if name:
    layer=next((l for l in spec['layers'] if l['name']==name),{})
    if 'pivot'in layer:e['pivot']=layer['pivot']
   by[path]=e
 merged=sorted(by.values(),key=lambda e:e['path']);M.write_text(json.dumps(merged,ensure_ascii=False,indent=2)+'\n')
 text=README.read_text();lines=text.splitlines();lines=[l for l in lines if not l.startswith('- T10e B5 full batch:')]
 text='\n'.join(lines)+'\n';text=text.replace('the other nine B5 vessels are in progress.','all ten B5 vessels are prepared for final review.')
 info='- T10e B5 full batch: Ten food and travel vessels have exact CLOSED stacks, complete revealed contents, 40/120 px strips, measured opening sheets and alpha WebP exports. [B5 review notes](_checks/b5-review.md) · [B5 contact sheet](_checks/b5-contact-sheet.png) · [Interactive art review](_checks/b5-review.html). Bento draws box → lid → knot; the knot fades before the lid lifts. Technical layer splits keep the locket stand still during pendant sway and hold the lantern backing steady while its soft halo flickers; the flame stays lit on opening. Glass overlays were adjusted with `adjust-glass-alpha.py` before being composited above their contents. Muted natural food colours follow Roy’s approved exception. Screens and catalogue wiring are separate.\n'
 text=text.replace('- T10e B5 balloon test:',info+'- T10e B5 balloon test:',1)
 a=text.index('## Masters\n');b=text.index('\n## Review\n',a);table=['## Masters','','| File | What | Size | Notes |','|---|---|---:|---|']
 for e in merged:
  notes=[]
  if 'pivot'in e:notes.append(f"pivot {e['pivot']['x']},{e['pivot']['y']}")
  if 'postprocess'in e:notes.append('processed; see manifest')
  if not e['transparent']:notes.append('opaque')
  table.append(f"| `{e['path'].removeprefix('design/art/')}` | {e['what']} | {e['size_px'][0]}×{e['size_px'][1]} | {', '.join(notes)} |")
 README.write_text(text[:a]+'\n'.join(table)+'\n'+text[b:])
 # Compact assembled, size, and parts contact sheets use only this batch.
 font=lambda n:ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',n)
 sheet=Image.new('RGB',(1250,590),'#F6F8FB');d=ImageDraw.Draw(sheet);d.text((15,12),'B5 FOOD AND TRAVEL · 10 VESSELS',font=font(24),fill='#16263F')
 sizes=Image.new('RGB',(1200,500),'#F6F8FB');sd=ImageDraw.Draw(sizes)
 for i,id in enumerate(IDS):
  im=Image.open(R/f'vessels/vessel-{id}.png').convert('RGBA');bg=Image.new('RGBA',im.size,'#F6F8FB');bg.alpha_composite(im);bg=bg.convert('RGB');x=i%5*250;y=45+i//5*270;sheet.paste(bg.resize((230,230),Image.Resampling.LANCZOS),(x+10,y));d.text((x+10,y+232),id,font=font(16),fill='#16263F')
  x=i%5*240;y=i//5*250;sizes.paste(bg.resize((40,40),Image.Resampling.LANCZOS),(x+12,y+45));sizes.paste(bg.resize((120,120),Image.Resampling.LANCZOS),(x+85,y+15));sd.text((x+10,y+160),id,font=font(16),fill='#16263F');sd.text((x+10,y+190),'40 px / 120 px',font=font(14),fill='#2F5D8A')
 sheet.save(C/'b5-contact-sheet.png',optimize=True);sizes.save(C/'b5-sizes.png',optimize=True)
 print('Registered B5:',len(IDS),'vessels;',len(merged),'total masters')
if __name__=='__main__':main()
