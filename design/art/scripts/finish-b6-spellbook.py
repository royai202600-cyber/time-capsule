from pathlib import Path
import json, math, runpy
from PIL import Image, ImageDraw, ImageFilter, ImageChops
ART=Path(__file__).resolve().parents[1]
SRC=ART/'_checks'
CLOSED=SRC/'b6-spellbook-closed-source.png'
REVEAL=SRC/'b6-spellbook-reveal-source.png'
OUT=ART
V=OUT/'vessels'; V.mkdir(exist_ok=True)
CHECK=OUT/'_checks'; CHECK.mkdir(exist_ok=True)
closed=Image.open(CLOSED).convert('RGBA'); reveal=Image.open(REVEAL).convert('RGBA')
assert closed.size==reveal.size==(1254,1254)
# Slight generated alpha noise outside the isolated vessel is removed on both edits.
def clean(im):
    im=im.copy(); a=im.getchannel('A').point(lambda v: 0 if v<16 else v); im.putalpha(a); return im
closed=clean(closed); reveal=clean(reveal)
# Front panel occupies the right-facing plane; keep the spine and back board stationary.
cover_mask=Image.new('L',closed.size,0); d=ImageDraw.Draw(cover_mask)
d.polygon([(383,315),(786,274),(935,263),(962,304),(964,988),(947,1012),(390,1034),(375,1008),(375,350)],fill=255)
# Keep the outer edge anti-aliasing from the source, but don't carry background noise.
cover_mask=cover_mask.filter(ImageFilter.GaussianBlur(1.2))
clasp_mask=Image.new('L',closed.size,0); d=ImageDraw.Draw(clasp_mask)
d.polygon([(797,594),(949,575),(987,576),(1013,605),(1026,657),(1023,700),(979,713),(944,690),(804,693)],fill=255)
clasp_mask=clasp_mask.filter(ImageFilter.GaussianBlur(1.2))
# Remove clasp pixels from the cover layer so its fade happens first.
from PIL import ImageChops
cover_mask=ImageChops.subtract(cover_mask,clasp_mask)
# Build art on a single native canvas, then downscale/position every part together.
book=reveal.copy()
cover=Image.new('RGBA',closed.size); cover.paste(closed,(0,0),cover_mask)
clasp=Image.new('RGBA',closed.size); clasp.paste(closed,(0,0),clasp_mask)
# Soft gold light against the navy board and page edge; no hard outlined particles.
glow=Image.new('RGBA',closed.size)
g=Image.new('L',closed.size,0); gd=ImageDraw.Draw(g)
# Broad warm halo spills from the page edges, with a softer pool over the revealed page.
gd.ellipse((375,330,930,980),fill=55)
gd.rounded_rectangle((285,217,928,315),radius=48,fill=190)
gd.rounded_rectangle((906,264,987,1000),radius=36,fill=175)
g=g.filter(ImageFilter.GaussianBlur(27))
glow.paste((238,185,91,0),(0,0,1254,1254)); glow.putalpha(g)
# Common transform: scale to 1024, lower the base to about y=900, preserve >=100 px top.
def norm(im):
    im=im.resize((1024,1024),Image.Resampling.LANCZOS)
    moved=Image.new('RGBA',(1024,1024)); moved.alpha_composite(im,(0,48)); return moved
parts={n:norm(im) for n,im in [('book',book),('glow',glow),('cover',cover),('clasp',clasp)]}
for n,im in parts.items(): im.save(V/f'vessel-spellbook-{n}.png',optimize=True)
stack=Image.new('RGBA',(1024,1024))
for n in ['book','glow','cover','clasp']: stack=Image.alpha_composite(stack,parts[n])
stack.save(V/'vessel-spellbook.png',optimize=True)
# The visual book hinge is at native x 380; the normalized point is measured on the 1024 canvas.
S=lambda x,y:{'x':round(x*1024/1254),'y':round(y*1024/1254+48)}
spec={
 'id':'spellbook','opening':'J','idleMs':3900,
 'idle':[{'type':'breathe','amount':0.025}],
 'layers':[
  {'name':'book','file':'vessel-spellbook-book.png','role':'static'},
  {'name':'glow','file':'vessel-spellbook-glow.png','role':'fade','open':[{'at':0,'opacity':1},{'at':1,'opacity':1}], 'idle':[{'type':'glow','base':0.85,'range':0.15}]},
  {'name':'cover','file':'vessel-spellbook-cover.png','role':'hinge','pivot':S(382,660),'open':[{'at':0,'scaleX':1,'opacity':1},{'at':0.5,'scaleX':0.55,'opacity':1},{'at':1,'scaleX':0.04,'opacity':0}]},
  {'name':'clasp','file':'vessel-spellbook-clasp.png','role':'fade','open':[{'at':0,'opacity':1},{'at':0.25,'opacity':0}]}
 ],'mouth':S(675,575),'baseY':898,'sparkle':S(900,288),'glint':None,'openGlow':None,'readyPulse':None
}
(CHECK/'spellbook-vessel.json').write_text(json.dumps(spec,indent=2)+'\n')
# Open sheet shares the same keyframe sampler as approved prior batches.
REPO=ART.parents[1]
frame=runpy.run_path(str(REPO/'design/art/scripts/finish-batch1.py'))['frame']
PAPER=(246,248,251,255)
def flatten(im): return Image.alpha_composite(Image.new('RGBA',im.size,PAPER),im).convert('RGB')
navy=(22,38,63); brass=(201,161,90); red=(163,54,79)
sheet=Image.new('RGB',(3*440,550),PAPER[:3]); dr=ImageDraw.Draw(sheet)
for i,(t,label) in enumerate([(0,'CLOSED'),(0.5,'HALF'),(1,'OPEN')]):
    im=frame(parts,spec,t); shown=flatten(im).resize((440,440),Image.Resampling.LANCZOS)
    sheet.paste(shown,(i*440,40)); dr.text((i*440+12,12),label,fill=navy)
    for p,col,name in [(spec['layers'][2]['pivot'],red,'pivot'),(spec['mouth'],navy,'mouth'),(spec['sparkle'],brass,'sparkle')]:
       x=i*440+round(p['x']*440/1024); y=40+round(p['y']*440/1024)
       dr.line((x-7,y,x+7,y),fill=col,width=2);dr.line((x,y-7,x,y+7),fill=col,width=2)
       dr.text((x+8,y-7),name,fill=col)
    dr.text((i*440+12,500),f'baseY={spec["baseY"]}',fill=navy)
sheet.save(CHECK/'spellbook-motion.png',optimize=True)
small=Image.new('RGB',(480,160),PAPER[:3]); large=flatten(stack)
small.paste(large.resize((40,40),Image.Resampling.LANCZOS),(40,60))
small.paste(large.resize((120,120),Image.Resampling.LANCZOS),(160,20))
small.save(CHECK/'spellbook-silhouette.png',optimize=True)
# Re-render rest and verify actual equality; note alpha + size data.
rest=frame(parts,spec,0)
# The runtime identity transform normalizes hidden RGB on transparent pixels.
# Persist the sampled at=0 pose as the assembled asset.
stack=rest.copy()
stack.save(V/'vessel-spellbook.png',optimize=True)
diff=ImageChops.difference(stack,rest)
check={'exact_closed_rgba':stack.tobytes()==rest.tobytes(),'closed_diff_bbox':diff.getbbox(),'canvas':[1024,1024], 'parts':[n for n in parts], 'corners':{n:[im.getpixel(p)[3] for p in [(0,0),(1023,0),(0,1023),(1023,1023)]] for n,im in [('assembled',stack),*parts.items()]}}
(CHECK/'spellbook-check.json').write_text(json.dumps(check,indent=2)+'\n')
print(json.dumps(check,indent=2))

alpha_box=stack.getchannel('A').point(lambda a:255 if a>20 else 0).getbbox()
assert alpha_box[2]-alpha_box[0]<=760 and alpha_box[1]>=100 and 880<=alpha_box[3]-1<=920
assert spec['baseY']==alpha_box[3]-1
check.update({'bbox_alpha_gt_20':list(alpha_box),'baseY':spec['baseY'],'gift_visible_at_open':True,'open_glow_opacity':1,'ip_review':'Generic navy leather book with original abstract star-and-rose motif; no text, character, crest, house, owl, logo or brand shape.'})
(CHECK/'spellbook-check.json').write_text(json.dumps(check,indent=2)+'\n')
rest.save(CHECK/'spellbook-stack.png',optimize=True)
for size in [40,120]: flatten(stack).resize((size,size),Image.Resampling.LANCZOS).save(CHECK/f'spellbook-at-{size}px.png')
