#!/usr/bin/env python3
"""Register B3 only, retaining every other batch's metadata and art bytes."""
import json,subprocess,hashlib
from pathlib import Path
from PIL import Image
R=Path(__file__).resolve().parents[1];C=R/'_checks';REPO=R.parent.parent
NAMES={'lucky-cat':'Folk lucky cat with letter drawer','mooncake-tin':'Cloud-pattern mooncake tin','cake-box':'Windowed birthday cake box','candy-box':'Octagonal eight-compartment New Year candy box','chocolate-heart':'Ribboned heart chocolate box','stocking':'Knitted Christmas stocking','pumpkin':'Friendly pumpkin lantern','rice-dumpling':'Bamboo-leaf rice dumpling','wish-tag':'Blank bamboo wish tag','river-lantern':'Floating lotus memorial lantern'}
def main():
 specs=json.loads((C/'b3-specs.json').read_text());specs['lucky-cat']=json.loads((C/'b3-lucky-cat-spec.json').read_text())
 prompts=json.loads((C/'b3-prompts.json').read_text());prompts.update(json.loads((C/'b3-lucky-cat-prompts.json').read_text()))
 prompts['vessels/vessel-lucky-cat-drawer-closed.png']=prompts['vessels/vessel-lucky-cat.png']
 prompts['vessels/vessel-lucky-cat-drawer.png']=json.loads((C/'b3-drawer-fix-prompt.json').read_text())['prompt']
 entries=json.loads((R/'manifest.json').read_text());paths=set()
 cachepath=C/'b3-export-hashes.json';cache=json.loads(cachepath.read_text()) if cachepath.exists() else {};newcache={}
 for id,spec in specs.items():
  files=[(f'vessel-{id}.png',None)]+[(l['file'],l)for l in spec['layers']]
  for filename,layer in files:
   rel='vessels/'+filename;path='design/art/'+rel;paths.add(path)
   im=Image.open(R/rel).convert('RGBA');assert im.size==(1024,1024)
   entry={'path':path,'what':NAMES[id]+(' — '+layer['name']+' layer' if layer else ' — assembled closed'),'size_px':[1024,1024],'transparent':True,'prompt':prompts[rel],'model':'gpt-image-2','web_export':'public/art/'+rel[:-4]+'.webp','postprocess':'finish-b3.py: exact registered extraction from assembled art and complete gpt-image-2 reveal edit, common canvas normalization; closed assembly applies every at=0 keyframe.'}
   if id=='lucky-cat':entry['postprocess']='finish-b3-lucky-cat.py: approved cat/paw/base/assembled bytes retained; original closed drawer front fades into full drawer with sides, interior and rolled letter; full drawer opens straight forward y +0.10, scale 1.08.'
   if (C/'b3-fix-config.json').exists() and id in ('pumpkin','rice-dumpling','candy-box','river-lantern'):
    entry['postprocess'] += ' T10c-fix: '+{'pumpkin':'masked amber-orange shell recolour, preserving alpha, face and glow.','rice-dumpling':'masked teal-green bamboo leaves matching the dome leaf direction, preserving rice/string/alpha.','candy-box':'octagonal gpt-image-2 assembled/reveal edits, aligned on the same 1024 canvas; filenames and motion metadata retained.','river-lantern':'glow opening opacity stays 1 throughout; all remaining motion retained.'}[id]
   if layer and 'pivot'in layer:entry['pivot']=layer['pivot']
   if not layer:entry['vessel']=spec
   entries=[e for e in entries if e['path']!=path];entries.append(entry)
   output=REPO/entry['web_export'];digest=hashlib.sha256((R/rel).read_bytes()).hexdigest();newcache[path]=digest
   if cache.get(path)==digest and output.exists():continue
   # Do not re-encode accepted, unchanged lucky-cat exports.
   unchanged=subprocess.run(['git','diff','--quiet','3e7e470','--',path],cwd=REPO).returncode==0
   if id=='lucky-cat' and unchanged and output.exists():continue
   if filename=='vessel-lucky-cat-drawer-closed.png':
    old=subprocess.check_output(['git','show','3e7e470:public/art/vessels/vessel-lucky-cat-drawer.webp'],cwd=REPO);output.write_bytes(old);continue
   im.resize((512,512),Image.Resampling.LANCZOS).save(output,'WEBP',quality=85,method=6)
 cachepath.write_text(json.dumps(newcache,indent=2)+'\n')
 entries.sort(key=lambda e:e['path']);(R/'manifest.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n')
 readme=(R/'README.md').read_text();lines=readme.splitlines()
 lines=[l for l in lines if not l.startswith('- T10c B3 ')]
 lines=[l for l in lines if not any(l.startswith('| `vessels/vessel-'+id+'.png`') or l.startswith('| `vessels/vessel-'+id+'-') for id in NAMES)]
 note='- T10c B3: ten original festival/keepsake vessels, complete reveal edits, exact CLOSED keyframes, measured 40/120 px and opening sheets. Lucky-cat test approved by Roy; its full drawer pulls straight forward with a rolled letter, while approved cat/paw/base/closed bytes remain unchanged. Separate dark interior layers support the pumpkin/river glows; the stocking stand stays fixed while sock/letter sway. Only river water is ground. PR #56 approved and merged as 4309b55. T10c-fix colour/shape/light review awaits Roy’s OK.'
 ix=lines.index('## Rules and checks')+2;lines.insert(ix,note)
 for i,l in enumerate(lines):
  if l.startswith('PNG masters live'):
   before,after=l.split('Place IDs:',1);before=before.rstrip().rstrip('.')
   missing=[id for id in NAMES if id not in before];lines[i]=before+(', '+', '.join(missing) if missing else '')+'. Place IDs:'+after
 ix=lines.index('## Review')
 while ix>0 and not lines[ix-1].strip():
  del lines[ix-1];ix-=1
 rows=[]
 for e in entries:
  if e['path']in paths:rows.append('| `'+e['path'].removeprefix('design/art/')+'` | '+e['what']+' | 1024×1024 | B3; see manifest |')
 lines[ix:ix]=rows+['']
 if not any('[B3 motion index]'in l for l in lines):lines+=['','[B3 motion index](_checks/b3-review.md)']
 (R/'README.md').write_text('\n'.join(lines)+'\n')
 review=['# B3 art review','', 'Generated with built-in gpt-image-2 and approved style sheet A. All ten CLOSED stacks match their masters exactly.','', '[Contact sheet](b3-contact-sheet.png)','']
 for id in specs:review+=['- '+id+': [motion]('+id+'-motion.png) · [40/120 px]('+id+'-silhouette.png)']
 review+=['','The proposed vessel blocks are in ../manifest.json. No app or database wiring is included.','', 'IP review: traditional/generic festival objects; blank tags/coin, no logos, text, branded silhouettes or franchise characters.','']
 if (C/'b3-fix-config.json').exists():review+=['T10c-fix: [40/120 px before/after](b3-fix-review.png) · [browser review](b3-fix-review.html). Follow-up visual approval is pending.','']
 (C/'b3-review.md').write_text('\n'.join(review));print('Registered',len(paths),'B3 masters, retaining other art metadata.')
if __name__=='__main__':main()
