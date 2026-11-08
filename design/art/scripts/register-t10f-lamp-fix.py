from pathlib import Path
import json
A=Path(__file__).resolve().parents[1];C=A/'_checks';p=A/'manifest.json';data=json.loads(p.read_text());spec=json.loads((C/'wishing-lamp-vessel.json').read_text());prompts=json.loads((C/'t10f-fix-prompts.json').read_text())
for entry in data:
 if entry['path'].startswith('design/art/vessels/vessel-wishing-lamp'):
  entry['prompt']=prompts['reveal'] if entry['path'].endswith('-lamp.png') else prompts['closed']
  entry['postprocess']='T10f-fix: original antique oval brass lamp redraw; lid masked from assembled edit, complete generated open mouth, separate soft smoke from spout tip. Common 1024 canvas normalization and sampled at=0 assembly via finish-t10f-lamp-fix.py. Same filenames and roles.'
  if 'vessel' in entry:entry['vessel']=spec
p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
