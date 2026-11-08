"""Time Capsule concept processing; writes only inside this concept folder."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFilter, ImageFont
P=Path(__file__).resolve().parent
LAND=(243,239,230); NAVY=(22,38,63); BRASS=(201,161,90); PLUM=(110,43,63)
SIZE=(1024,1536)
NAMES=("waypost-gem-purple",)
def load(path): return Image.open(path).convert("RGBA")
def box(im): return im.getchannel("A").point(lambda x:255 if x>=16 else 0).getbbox()
def crop(im): return im.crop(box(im))
def resized(im,width=None,height=None):
    scale=width/im.width if width else height/im.height
    return im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
def fit(im,w,h):
    im=im.copy();im.thumbnail((w,h),Image.Resampling.LANCZOS);return im
def layer(im,xy):
    out=Image.new("RGBA",SIZE);out.alpha_composite(im,xy);return out
def export(name,im): im.save(P/name)
LANDMARKS=("landmark-gem-deep-purple",)
def derive_gems():
    source=load(P/"waypost/landmark-a-gem.png")
    alpha=source.getchannel("A");w,h=source.size
    bands=[]
    for y in range(h):
        if alpha.crop((0,y,w,y+1)).getextrema()[1]>0:
            if not bands or y>bands[-1][1]+1:bands.append([y,y])
            else:bands[-1][1]=y
    if len(bands)!=2 or bands[1][0]-bands[0][1]<2:
        raise RuntimeError("Small upper gem is not cleanly separate; stop for Roy.")
    # Exactly delete the separate upper piece, then crop/centre without resampling.
    lower=source.crop((0,bands[1][0],w,h))
    piece=lower.crop(lower.getchannel("A").getbbox())
    common=Image.new("RGBA",source.size)
    common.paste(piece,((w-piece.width)//2,(h-piece.height)//2))
    export("waypost/waypost-gem-purple.png",common)
    r,g,b,a=source.split()
    deeper=Image.merge("RGBA",tuple(ch.point(lambda v:round(v*.8)) for ch in (r,g,b))+(a,))
    export("waypost/landmark-gem-deep-purple.png",deeper)
def overview():
    out=load(P/"screens/map-plain.png")
    hero=resized(crop(load(P/"cracks/hourglass-corrupted-a.png")),height=200)
    out.alpha_composite(hero,((1024-hero.width)//2,500))
    for cx,cy in ((170,650),(850,740),(610,1130)):
        name=NAMES[0]
        im=resized(crop(load(P/f"waypost/{name}.png")),width=56)
        out.alpha_composite(im,(cx-im.width//2,cy-im.height))
    for name,(cx,cy) in zip(LANDMARKS,((380,290),)):
        im=resized(crop(load(P/f"waypost/{name}.png")),width=110)
        out.alpha_composite(im,(cx-im.width//2,cy-im.height))
    export("screens/map-capsule-and-wayposts.png",out.convert("RGB"))
def small_check():
    out=Image.new("RGBA",(500,300),LAND+(255,))
    for name,cx,sizes in ((NAMES[0],150,(48,64)),(LANDMARKS[0],350,(64,96))):
        for row,size in enumerate(sizes):
            im=fit(crop(load(P/f"waypost/{name}.png")),size,size)
            out.alpha_composite(im,(cx-im.width//2,25+row*135))
    export("checks/wayposts-64.png",out)
def sheet():
    font=ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf",24)
    title=ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf",32)
    names=("Waypost: purple gem",)
    rows=[
      ("1 Balls",[(str(f.relative_to(P)),f.stem.replace("ball-","Ball ").replace("-"," ")) for f in sorted((P/"ball").glob("*.png"))],400),
      ("",[("checks/balls-64.png","All five balls at 64 px: map land / white road")],220),
      ("2 Crack effect",[(f"cracks/crack-{k}{s}.png",f"Crack {k[0].upper()}: "+("raw ink" if s else "transparent + pale edge")) for k in ("a-large","b-fine") for s in ("-raw","")],400),
      ("",[(f"cracks/hourglass-{k}.png",label) for k,label in (("corrupted-a","Corrupted A"),("corrupted-b","Corrupted B"),("restored","Restored"))]+[("cracks/other-vessels-proof.png","Shared effect on three other vessels")],450),
      ("",[("checks/hourglasses-120-64.png","Corrupted A / Corrupted B / Restored at 120 and 64 px")],260),
      ("3 Throw and hit",[("screens/screen-throw.png","Throw: shared catch background, no target artwork"),("screens/screen-hit.png","Hit: separate dust and mending capsule")],700),
      ("",[("screens/catch-background.png","Shared catch and Landmark fight background")],650),
      ("",[("screens/hit-dust.png","Separate wax-red dust effect")],220),
      ("4 Common Wayposts",[(f"waypost/{n}.png",label) for n,label in zip(NAMES,names)],320),
      ("",[("checks/wayposts-64.png","Common gem: 48/64 px; Landmark gem: 64/96 px")],500),
      ("5 Landmark Waypost",[("waypost/landmark-gem-deep-purple.png","Landmark Waypost: deep purple gem")],400),
      ("",[("screens/map-capsule-and-wayposts.png","Map: floating common and Landmark markers"),("screens/screen-landmark-fight.png","Landmark fight: giant Corrupted Capsule")],650),
      ("6 To whoever passes by",[("whoever/portrait-a-bench.png","Portrait A: waiting envelope on bench"),("whoever/portrait-b-lamp.png","Portrait B: envelope tied to lamp")],380),
      ("",[("whoever/scene-a-bench.png","Scene A: envelope waiting on bench"),("whoever/scene-b-lamp.png","Scene B: envelope tied to lamp")],450),
      ("",[("checks/portraits-24-40.png","Both portraits at actual 24 and 40 px")],150)
    ]
    height=sum(h+80 for _,_,h in rows)
    out=Image.new("RGBA",(2200,height),(246,248,251,255));d=ImageDraw.Draw(out);y=0
    for heading,items,h in rows:
        if heading:d.text((24,y+4),heading,font=title,fill=NAVY)
        y+=44;cw=2200//len(items)
        for i,(path,label) in enumerate(items):
            im=fit(load(P/path),cw-32,h-42)
            out.alpha_composite(im,(i*cw+(cw-im.width)//2,y+(h-42-im.height)//2))
            d.text((i*cw+16,y+h-35),label,font=font,fill=NAVY)
        y+=h+36
    export("contact-sheet.png",out.convert("RGB"))
if __name__=="__main__":
    derive_gems();overview();small_check();sheet()
