#!/usr/bin/env python3
"""Review the sea scene and verify existing master/export images are immutable."""
import hashlib,json,subprocess
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];REPO=ROOT.parents[1];CHECKS=ROOT/'_checks'
def main():
 baseline=json.loads((CHECKS/'public-sea-baseline.json').read_text());changed=[]
 for rel,digest in baseline['files'].items():
  if hashlib.sha256((REPO/rel).read_bytes()).hexdigest()!=digest:changed.append(rel)
 assert not changed,changed
 old=json.loads(subprocess.check_output(['git','show',baseline['base_commit']+':design/art/manifest.json'],cwd=REPO));current=json.loads((ROOT/'manifest.json').read_text());lookup={e['path']:e for e in current}
 assert all(lookup[e['path']]==e for e in old),'existing manifest record changed'
 assets=[]
 for rel,size in [('design/art/portraits/portrait-sea.png',(1024,1024)),('design/art/scenes/scene-sea-sealed.png',(1536,1024)),('public/art/portraits/portrait-sea.webp',(512,512)),('public/art/scenes/scene-sea-sealed.webp',(1536,1024))]:
  im=Image.open(REPO/rel).convert('RGBA');assert im.size==size,(rel,im.size)
  a=im.getchannel('A');corners=[a.getpixel(p) for p in ((0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1))];assert corners==[0]*4,(rel,corners)
  assets.append({'path':rel,'size':list(im.size),'corners_alpha':corners,'intermediate_alpha_pixels':sum(a.histogram()[1:255])})
 # Same paper texture and 390px display width for both scene compositions.
 paper=Image.open(ROOT/'textures/paper.png').convert('RGB');review=paper.crop((0,0,840,340));d=ImageDraw.Draw(review);p=Path('/System/Library/Fonts/Supplemental/Arial.ttf');font=ImageFont.truetype(p,19) if p.exists() else ImageFont.load_default()
 for x,name,label in ((20,'scene-sealed.png','Existing sealed scene'),(430,'scene-sea-sealed.png','Sea bottle sent — 390px wide')):
  im=Image.open(ROOT/'scenes'/name).convert('RGBA').resize((390,260),Image.Resampling.LANCZOS);review.paste(im,(x,55),im);d.text((x,20),label,fill='#16263F',font=font)
 review.save(CHECKS/'scene-sea-sealed-review.png',optimize=True)
 report={'baseline_main_commit':baseline['base_commit'],'existing_master_export_images_checked':len(baseline['files']),'existing_images_changed':changed,'nine_existing_portraits_unchanged':True,'existing_manifest_records_unchanged':len(old),'assets':assets,'review_scene_display_width_px':390,'app_portrait_crop':[75,96,935,956],'portrait_display_px':[24,40,60],'draft_review_requires_Roy_OK':True}
 (CHECKS/'public-sea-check.json').write_text(json.dumps(report,indent=2)+'\n');print(len(baseline['files']),'existing images and',len(old),'existing manifest records unchanged; four new masters/exports PASS')
if __name__=='__main__':main()
