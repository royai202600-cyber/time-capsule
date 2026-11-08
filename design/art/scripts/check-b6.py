from pathlib import Path
from PIL import Image
import json,runpy
A=Path('design/art');R=Path.cwd();m=json.loads((A/'manifest.json').read_text());F=runpy.run_path(str(A/'scripts/finish-batch1.py'))['frame'];ids=['spellbook','escape-pod','crystal-ball','wishing-lamp','potion','pocket-watch','diploma-tube','baby-shoes','memorial-candle','rocket-tin'];paper=(246,248,251,255)
for id in ids:
 entry=next(x for x in m if x.get('vessel',{}).get('id')==id);spec=entry['vessel'];parts={l['name']:Image.open(A/'vessels'/l['file']).convert('RGBA') for l in spec['layers']};assembled=Image.open(A/'vessels'/f'vessel-{id}.png').convert('RGBA');rest=F(parts,spec,0)
 assert rest.tobytes()==assembled.tobytes(),id
 bb=assembled.getchannel('A').point(lambda a:255 if a>20 else 0).getbbox();assert bb[2]-bb[0]<=760 and bb[1]>=100 and 880<=bb[3]-1<=920 and spec['baseY']==bb[3]-1,(id,bb,spec['baseY'])
 assert 3400<=spec['idleMs']<=4600 and not any(l.get('ground') for l in spec['layers'])
 for l in spec['layers']:
  assert not any(i['type']=='drift' for i in l.get('idle',[])) or l['name'] in ('smoke','bubbles')
 for n,im in [('assembled',assembled),*parts.items()]:
  assert im.size==(1024,1024) and all(im.getpixel(q)[3]==0 for q in [(0,0),(0,1023),(1023,0),(1023,1023)]),(id,n)
  p=R/'public/art/vessels'/f'vessel-{id}{"-"+n if n!="assembled" else ""}.webp';w=Image.open(p).convert('RGBA');assert w.size==(512,512) and all(w.getpixel(q)[3]==0 for q in [(0,0),(0,511),(511,0),(511,511)]),(id,n)
 bg=Image.new('RGBA',assembled.size,paper);bg.alpha_composite(assembled);bg.convert('RGB').resize((40,40),Image.Resampling.LANCZOS).save(A/'_checks'/f'{id}-at-40px.png')
 if id=='diploma-tube':
  bb=parts['diploma'].getchannel('A').point(lambda a:255 if a>20 else 0).getbbox(); assert bb[1]-.08*1024>=0 and bb[3]-.08*1024<=1024,bb
 if id in ('spellbook','memorial-candle'):
  glow=next(l for l in spec['layers'] if l['name']=='glow');assert glow['open'][0]['opacity']==glow['open'][-1]['opacity']==1
 print(id,'PASS')
