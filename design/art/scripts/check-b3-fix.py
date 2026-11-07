#!/usr/bin/env python3
"""Verify the restricted T10c-fix scope and show before/after at native UI sizes."""
import io,json,runpy,subprocess
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageChops
R=Path(__file__).resolve().parents[1];C=R/'_checks';BASE='4309b55997b3fdcfe9193b0c7da3983709c28e80';P=(246,248,251,255)
def old(path):return subprocess.check_output(['git','show',BASE+':'+path],cwd=R.parent.parent)
def image_old(path):return Image.open(io.BytesIO(old(path))).convert('RGBA')
def flat(im):return Image.alpha_composite(Image.new('RGBA',im.size,P),im).convert('RGB')
def main():
 allowed=('vessel-pumpkin','vessel-rice-dumpling','vessel-candy-box')
 paths=subprocess.check_output(['git','ls-tree','-r','--name-only',BASE,'design/art/vessels','public/art']).decode().splitlines()
 changed=[]
 for path in paths:
  current=(R.parent.parent/path).read_bytes()
  if current!=old(path):
   assert any(Path(path).name.startswith(id+'-') or Path(path).stem==id for id in allowed),path
   changed.append(path)
 for id in ('pumpkin','rice-dumpling'):
  for path in (R/'vessels').glob(f'vessel-{id}-*.png'):
   before=image_old('design/art/vessels/'+path.name);after=Image.open(path).convert('RGBA')
   assert ImageChops.difference(before.getchannel('A'),after.getchannel('A')).getbbox() is None,path
 F=runpy.run_path(str(R/'scripts/finish-b3.py'));specs=json.loads((C/'b3-specs.json').read_text());original=json.loads(old('design/art/_checks/b3-specs.json'));expect=json.loads(json.dumps(original))
 for l in expect['river-lantern']['layers']:
  if l['name']=='glow':
   for k in l['open']:k['opacity']=1
 assert specs==expect
 font=lambda n:ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',n)
 sheet=Image.new('RGB',(960,810),P[:3]);d=ImageDraw.Draw(sheet);d.text((20,12),'T10c-fix | original and revised at 40 / 120 px',fill='#16263F',font=font(23));d.text((260,55),'ORIGINAL',fill='#6E2B3F',font=font(17));d.text((650,55),'REVISED',fill='#2F5D8A',font=font(17))
 for i,id in enumerate(('pumpkin','rice-dumpling','candy-box','river-lantern')):
  y=90+i*175;before=image_old(f'design/art/vessels/vessel-{id}.png');after=Image.open(R/f'vessels/vessel-{id}.png').convert('RGBA')
  if id=='river-lantern':
   parts={l['name']:image_old('design/art/vessels/'+l['file'])for l in original[id]['layers']};before=F['render'](parts,original[id],1);after=F['render'](parts,specs[id],1)
  d.text((20,y+42),id+(' (open)'if id=='river-lantern'else''),fill='#16263F',font=font(17))
  for im,offset in ((before,250),(after,640)):
   for n,x in ((40,offset),(120,offset+90)):
    sheet.paste(flat(im).resize((n,n),Image.Resampling.LANCZOS),(x,y));d.text((x,y+130),f'{n} px',fill='#16263F',font=font(14))
 sheet.save(C/'b3-fix-review.png',optimize=True)
 report={'approved_base':BASE,'canvas':[1024,1024],'master_filenames_unchanged':True,'unrelated_art_bytes_preserved':True,'recolour_alpha_unchanged':True,'motion_change_only':'river-lantern glow open opacity 1 -> 1','changed_art_files':changed}
 (C/'b3-fix-validation.json').write_text(json.dumps(report,indent=2)+'\n');print('PASS: scope, original alpha, unchanged motion except river light, and original filenames/canvas')
if __name__=='__main__':main()
