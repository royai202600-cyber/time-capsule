import json
from pathlib import Path
A=Path(__file__).resolve().parents[1];R=A.parents[1]; C=A/'_checks'; v=A/'vessels';style=(A/'STYLE.md').read_text().split('```\n',1)[1].split('\n```',1)[0]
reveal={x['id']:x['prompt'] for x in json.loads((C/'b6-reveal-prompts.json').read_text())};rework={x['id']:x['prompt'] for x in json.loads((C/'b6-rework-prompts.json').read_text())}; fixes={x['id']:x['prompt'] for x in json.loads((C/'b6-fix-prompts.json').read_text())};isol={x['id']:x['prompt'] for x in json.loads((C/'b6-isolation-prompts.json').read_text())}
orig={'potion':'A round-bottomed glass flask containing luminous wax-red liquid and small bubbles, sealed with a distinct cork. Glass remains clear and reveals liquid.','pocket-watch':'A closed brass hunter-case pocket watch with a chain, cover engraved with a simple rose. No clock face visible while closed. Its side hinged cover will reveal an unnumbered clock face.','diploma-tube':'A closed upright navy cylindrical diploma tube with a brass cap seated firmly over its top. It contains a tied rolled diploma to be revealed.','baby-shoes':'A CLOSED small keepsake box tied with a ribbon, solid lid covering contents entirely; inside it contains a pair of tiny knitted baby shoes to be revealed.','memorial-candle':'A gentle respectful candle in a glass jar with a CLOSED lid seated on the rim; soft warm flame visible in front of a dark background behind it. No religious symbols.','rocket-tin':'A closed original retro tin toy rocket standing upright on fins, with a circular porthole and solid nose cone firmly attached. An intact rolled letter is hidden inside.'}
for id,subject in orig.items():
 mid=' One single centered object, transparent square canvas, recognizable at 40 and 120 px, no ground; generous room above.'
 if id!='potion':mid+=' The object must be CLOSED, lid firmly attached; do not draw a separate opened view.'
 orig[id]=f'Use case: illustration-story. Asset: {id} {"closed vessel" if id=="potion" else "closed assembled vessel"} for a mobile app. {subject}{mid} original design, no logos, no brand names or brand shapes, no characters, no text. No wizard-school crests, houses, owls or scarred heroes; no genie figure; no spaceship from any film or show.\n{style}'
correct={'escape-pod':'Close the hatch completely flush across the front opening. Hide the letter inside. Keep porthole, body, perspective, position, proportions and all other details; do not show the hatch open.','crystal-ball':"Seat the crystal ball firmly onto the rim of the brass cup; no gap. The ball covers the cup's contents in the closed state. Preserve the stand, mist, perspective, scale, colors and style."}
for id,request in correct.items():orig[id]=f'Use case: precise-object-edit. Asset: closed assembled {id} vessel. Image 1 is the target artwork; image 2 is the required style reference. {request} No separate panels or open views. original design, no logos, no brand names or brand shapes, no characters, no text. No wizard-school crests, houses, owls or scarred heroes; no genie figure; no famous animated-film lamp shape; no spaceship from any film or show.\n{style}'
orig['wishing-lamp']=rework['lamp']
ids=['escape-pod','crystal-ball','wishing-lamp','potion','pocket-watch','diploma-tube','baby-shoes','memorial-candle','rocket-tin']
for id in ids:assert style in orig[id] and style in reveal[id]
p= A/'manifest.json';data=json.loads(p.read_text());data=[x for x in data if not any(x['path'].startswith(f'design/art/vessels/vessel-{id}') for id in ids)]
extra=json.loads((C/'b6-extra-prompts.json').read_text())
for id in ids:
 spec=json.loads((C/f'{id}-vessel.json').read_text());names=[None]+[x['name'] for x in spec['layers']]
 for n in names:
  name=f'vessel-{id}'+(f'-{n}' if n else '')+'.png';assert (v/name).exists(),name
  prompt=orig[id] if n is None or n in ('hatch','cover','lid','cap','cone','cork') else reveal[id]
  if id=='crystal-ball' and n=='mist':prompt=isol['crystal-mist']
  if id=='crystal-ball' and n=='ball':prompt=isol['crystal-glass']
  if id=='potion' and n=='bubbles':prompt=isol['potion-bubbles']
  if id=='diploma-tube' and n=='diploma':prompt=rework['diploma']
  if id=='rocket-tin' and n=='rocket':prompt=fixes['rocket']
  if id=='wishing-lamp' and n=='lamp':prompt=extra['lamp-empty']+'\n\nSecond reveal edit:\n'+fixes['lamp']
  if id=='potion' and n=='flask':prompt=extra['potion-no-bubbles']+'\n\nReveal edit:\n'+reveal[id]
  if id=='diploma-tube' and n=='tube':prompt=extra['diploma-empty']
  entry={'path':'design/art/vessels/'+name,'what':f'{id} '+(n+' layer' if n else 'assembled vessel'),'size_px':[1024,1024],'transparent':True,'prompt':prompt,'model':'gpt-image-2','postprocess':'Common normalized 1024 canvas, aligned generated reveal and masked closed part, with scripted effects and sampled at=0 assembly; see B6 finish scripts. Glass interiors reduced to 37.5% where applicable.','web_export':'public/art/vessels/'+name.replace('.png','.webp')}
  if n is None:entry['vessel']=spec
  data.append(entry)
data.sort(key=lambda x:x['path']);p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
p=A/'README.md';s=p.read_text();mark='## Rules and checks\n';line='\n- T10f B6: ten original magic and milestone vessels have measured opening and 40/120 px sheets. The spellbook glow fix is approved; the remaining nine are presented for final batch review. Layer order, motion and anchors are proposed in the manifest; screen wiring and catalogue changes are separate. The lamp uses a cylindrical brass burner and short straight spout to avoid the well-known animated lamp silhouette. [B6 contact sheet](_checks/b6-contact-sheet.png).\n';s='\n'.join(x for x in s.split('\n') if not x.startswith('- T10f B6:'))
s=s.replace(mark,mark+line,1)
s='\n'.join(x for x in s.split('\n') if not any(x.startswith(f'| `vessels/vessel-{id}') for id in ids))
needle='## Masters\n';s=s.replace(needle,'## Masters\n',1)
rows='\n'.join(f'| `vessels/{x.name}` | {x.stem.removeprefix("vessel-")} | 1024×1024 | processed; see manifest |' for id in ids for x in sorted(v.glob(f'vessel-{id}*.png')))
marker='| `vessels/vessel-snow-globe-base.png`';idx=s.index(marker);s=s[:idx]+rows+'\n'+s[idx:];p.write_text(s)
print('registered',len(ids),'vessel entries')
