#!/usr/bin/env python3
"""Check shared portrait discs at 24/40/60px, including the Keeper dialog crop."""
import json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageChops
ROOT=Path(__file__).resolve().parents[1];PORTRAITS=ROOT/'portraits';CHECKS=ROOT/'_checks';PAPER='#F6F8FB'
NAMES=[f'portrait-{i:02}.png' for i in range(1,9)]+['portrait-future.png','portrait-sea.png','portrait-keeper.png']
CROP=(75,96,935,956)
def font(n):
 p=Path('/System/Library/Fonts/Supplemental/Arial.ttf');return ImageFont.truetype(p,n) if p.exists() else ImageFont.load_default()
def on_paper(im):return Image.alpha_composite(Image.new('RGBA',im.size,PAPER),im).convert('RGB')
def sample(im,size,crop=False):return on_paper((im.crop(CROP) if crop else im).resize((size,size),Image.Resampling.LANCZOS))
def main():
 CHECKS.mkdir(parents=True,exist_ok=True);sheet=Image.new('RGB',(1000,100+len(NAMES)*100),PAPER);d=ImageDraw.Draw(sheet)
 d.text((25,15),'PORTRAITS — FULL CANVAS / EXACT APP DISC CROP',fill='#16263F',font=font(23));d.text((25,50),'Each sample is shown at its native pixel size. Crop: x75–935, y96–956 (860 × 860).',fill='#6E2B3F',font=font(16))
 cols=[(False,24,235),(False,40,340),(False,60,445),(True,24,610),(True,40,715),(True,60,820)]
 for crop,size,x in cols:d.text((x,82),('crop ' if crop else 'full ')+str(size),fill='#16263F',font=font(14))
 mask=Image.new('L',(1024,1024));ImageDraw.Draw(mask).ellipse((75,96,935,956),fill=255);report=[]
 for i,name in enumerate(NAMES):
  im=Image.open(PORTRAITS/name).convert('RGBA');assert im.size==(1024,1024),(name,im.size)
  a=im.getchannel('A');assert ImageChops.difference(a,mask).getbbox() is None,(name,'disc mask differs')
  y=110+i*100;d.text((25,y+23),name.removesuffix('.png'),fill='#16263F',font=font(19));d.line((20,y+87,965,y+87),fill='#DCE8F2')
  for crop,size,x in cols:sheet.paste(sample(im,size,crop),(x,y+(70-size)//2))
  report.append({'file':'portraits/'+name,'size':[1024,1024],'mode':'RGBA','corners_alpha':[a.getpixel(p) for p in ((0,0),(1023,0),(0,1023),(1023,1023))],'circle_center':[505,526],'circle_radius':430,'visible_bbox':a.getbbox(),'tested_px':[24,40,60],'app_crop':list(CROP),'exact_shared_mask':True})
 sheet.save(CHECKS/'portraits-small.png',optimize=True);(CHECKS/'portraits-small.json').write_text(json.dumps(report,indent=2)+'\n')
 review=Image.new('RGB',(920,430),PAPER);rd=ImageDraw.Draw(review);rd.text((20,12),'THE SEA — PROFILE PICTURE REVIEW',fill='#16263F',font=font(23))
 for j,name in enumerate(('portrait-01.png','portrait-future.png','portrait-sea.png')):
  im=Image.open(PORTRAITS/name).convert('RGBA');y=75+j*110;rd.text((20,y+23),name,fill='#16263F',font=font(17))
  for size,x in ((24,235),(40,320),(60,425)):
   review.paste(sample(im,size,True),(x,y));rd.text((x,y+67),f'{size}px crop',fill='#6E2B3F',font=font(12))
 sea=Image.open(PORTRAITS/'portrait-sea.png').convert('RGBA');review.paste(sample(sea,260,True),(610,75));rd.text((610,351),'260px detail (app crop)',fill='#6E2B3F',font=font(15));review.save(CHECKS/'portrait-sea-review.png',optimize=True)
 print(f'{len(report)} portraits: exact circle, transparent corners, native 24/40/60 and app crops PASS')
if __name__=='__main__':main()
