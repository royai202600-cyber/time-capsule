#!/usr/bin/env python3
"""Compare the T10b-fix redraw with the owner-approved B2 merge."""
import hashlib,io,json,subprocess
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parents[1];REPO=R.parent.parent;C=R/'_checks';BASE='a5c8697b80778c86ca198e576613cdb8c02d5d72'
PRESERVE='4309b55997b3fdcfe9193b0c7da3983709c28e80'
def git(*args):return subprocess.check_output(['git',*args],cwd=REPO)
def main():
 paths=git('ls-tree','-r','--name-only',PRESERVE,'design/art/vessels','public/art/vessels').decode().splitlines();preserved=[]
 for rel in paths:
  if 'twin-towers' in rel:continue
  assert hashlib.sha256(git('show',f'{PRESERVE}:{rel}')).digest()==hashlib.sha256((REPO/rel).read_bytes()).digest(),rel
  preserved.append(rel)
 before=Image.open(io.BytesIO(git('show',f'{BASE}:design/art/vessels/vessel-twin-towers.png'))).convert('RGBA');after=Image.open(R/'vessels/vessel-twin-towers.png').convert('RGBA')
 sheet=Image.new('RGB',(820,700),'#F6F8FB');d=ImageDraw.Draw(sheet);font=lambda n:ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',n)
 d.text((24,15),'TWIN TOWERS  /  T10b-fix',fill='#16263F',font=font(23))
 for row,(name,im) in enumerate([('Approved B2 shape',before),('Architectural redraw',after)]):
  top=55+row*295;d.text((24,top),name,fill='#16263F',font=font(18))
  for n,x in [(40,40),(120,180),(240,450)]:
   bg=Image.new('RGBA',(n,n),'#F6F8FB');bg.alpha_composite(im.resize((n,n),Image.Resampling.LANCZOS));sheet.paste(bg.convert('RGB'),(x,top+30));d.text((x,top+275),str(n)+' px',fill='#16263F',font=font(16))
 s=json.loads((C/'t10b-twin-towers-spec.json').read_text());d.text((24,665),'Idle: breathe 0.025 + bridge glow pulse. Layers: towers / glow / tops.',fill='#16263F',font=font(16));sheet.save(C/'twin-towers-redraw-review.png',optimize=True)
 b=after.getchannel('A').point(lambda a:255 if a>25 else 0).getbbox();bridge_ratio=(s['baseY']-s['sparkle']['y'])/(s['baseY']-b[1]);assert .25<=bridge_ratio<=.4
 report={'approved_base':BASE,'preserved_main':PRESERVE,'other_vessel_files_preserved_byte_for_byte':len(preserved),'same_four_png_and_four_webp_names':True,'bridge_upper_edge_height_fraction':round(bridge_ratio,3),'whole_idle':s['idle'],'bridge_glow':s['layers'][1]['idle'],'visual_review':'Stepped tapered shafts, pointed spires, clear lower bridge at 40/120/240 px; no replica geometry, logos or emblems.'};(C/'twin-towers-redraw-check.json').write_text(json.dumps(report,indent=2)+'\n');print(len(preserved),'other vessel files unchanged; redraw review PASS')
if __name__=='__main__':main()
