"""Time Capsule concept processing; writes only inside this concept folder."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFilter, ImageFont
P=Path(__file__).resolve().parent
LAND=(243,239,230); NAVY=(22,38,63); BRASS=(201,161,90); PLUM=(110,43,63)
SIZE=(1024,1536)
NAMES=("simple-waypost-a-house","simple-waypost-b-hut","simple-waypost-c-kiosk","simple-spinner-a-pinwheel","simple-spinner-b-envelopes")
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
def shapes():
    for name in NAMES:
        f=P/f"waypost/{name}-raw.png";im=load(f)
        if max(im.size)>1024:im.thumbnail((1024,1024),Image.Resampling.LANCZOS)
        # Pad to a white square; preserve geometry and never upscale.
        if im.size!=(1024,1024):
            square=Image.new("RGBA",(1024,1024),"white");square.alpha_composite(im,((1024-im.width)//2,(1024-im.height)//2));im=square
        im.convert("RGB").save(f)
        gray=ImageOps.grayscale(im)
        alpha=gray.point(lambda v:max(0,min(255,round((255-v)*255/218))))
        # Remove near-white paper noise; retain antialiased boundaries.
        alpha=alpha.point(lambda v:0 if v<8 else v)
        for colour,rgb in (("brass",BRASS),("plum",PLUM)):
            out=Image.new("RGBA",im.size,rgb+(0,));out.putalpha(alpha)
            export(f"waypost/{name}-{colour}.png",out)
def compositions():
    folder=P/"screens/layers";folder.mkdir(exist_ok=True)
    background=load(P/"screens/map-plain.png")
    assert background.size==SIZE
    lost=load(P/"cracks/hourglass-lost-a.png")
    restored=load(P/"cracks/hourglass-restored.png")
    bounds=box(lost)
    capsule=resized(lost.crop(bounds),width=340)
    mended=resized(Image.blend(lost,restored,.6).crop(bounds),width=340)
    x=(1024-capsule.width)//2;y=260
    shadow=Image.new("RGBA",SIZE);d=ImageDraw.Draw(shadow)
    d.ellipse((x+35,y+capsule.height-8,x+capsule.width-35,y+capsule.height+25),fill=NAVY+(48,))
    shadow=shadow.filter(ImageFilter.GaussianBlur(12))
    ball=resized(crop(load(P/"ball/ball-a-smooth.png")),width=180)
    ball_layer=layer(ball,((1024-ball.width)//2,1270))
    capsule_layer=layer(capsule,(x,y));mending_layer=layer(mended,(x,y))
    dust=resized(crop(load(P/"screens/hit-dust.png")),width=620)
    dust_layer=layer(dust,((1024-dust.width)//2,y+(capsule.height-dust.height)//2))
    for name,im in (("shadow",shadow),("capsule-lost",capsule_layer),("capsule-mending",mending_layer),("ball-a",ball_layer),("dust",dust_layer)):
        export(f"screens/layers/{name}.png",im)
    throw=background.copy()
    for im in (shadow,capsule_layer,ball_layer):throw=Image.alpha_composite(throw,im)
    export("screens/screen-throw.png",throw.convert("RGB"))
    hit=background.copy()
    for im in (shadow,mending_layer,dust_layer):hit=Image.alpha_composite(hit,im)
    export("screens/screen-hit.png",hit.convert("RGB"))
    overview=background.copy()
    hero=resized(crop(lost),height=200);overview.alpha_composite(hero,((1024-hero.width)//2,500))
    for name,(cx,cy) in zip(NAMES[:3],((170,650),(850,740),(610,1130))):
        im=resized(crop(load(P/f"waypost/{name}-brass.png")),width=64)
        overview.alpha_composite(im,(cx-im.width//2,cy-im.height//2))
    export("screens/map-capsule-and-wayposts.png",overview.convert("RGB"))
def small_check():
    out=Image.new("RGBA",(1000,260),LAND+(255,))
    for i,name in enumerate(NAMES):
        for j,colour in enumerate(("brass","plum")):
            for row,size in enumerate((48,64)):
                im=fit(crop(load(P/f"waypost/{name}-{colour}.png")),size,size)
                out.alpha_composite(im,(i*200+j*90+(90-im.width)//2,15+row*125+(80-im.height)//2))
    export("checks/wayposts-64.png",out)
def sheet():
    font=ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf",24)
    title=ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf",32)
    names=("Waypost A: small house","Waypost B: low hut","Waypost C: narrow kiosk","Spinner A: pinwheel","Spinner B: envelopes")
    rows=[
      ("1 Balls",[(str(f.relative_to(P)),f.stem.replace("ball-","Ball ").replace("-"," ")) for f in sorted((P/"ball").glob("*.png"))],400),
      ("",[("checks/balls-64.png","All five balls at 64 px: map land / white road")],220),
      ("2 Shared crack effect",[(f"cracks/crack-{k}{s}.png",f"Crack {k[0].upper()}: "+("raw ink" if s else "transparent + pale edge")) for k in ("a-large","b-fine") for s in ("-raw","")],400),
      ("",[(f"cracks/hourglass-{k}.png",label) for k,label in (("lost-a","Hourglass: large cracks"),("lost-b","Hourglass: fine cracks"),("restored","Hourglass: untouched master"))]+[("cracks/other-vessels-proof.png","Shared effect on three other vessels")],450),
      ("",[("checks/hourglasses-120-64.png","Lost A / Lost B / restored at 120 and 64 px")],260),
      ("3 Catch on the plain map",[("screens/screen-throw.png","Throw on the plain map, the app draws the circle"),("screens/screen-hit.png","Hit: separate dust and mending capsule")],700),
      ("",[("screens/map-plain.png","Plain map: no objects or interface"),("screens/map-capsule-and-wayposts.png","Detailed capsule, quiet brass buildings")],650),
      ("",[("screens/hit-dust.png","Separate wax-red dust effect")],220),
      ("4 Quiet Wayposts",[(f"waypost/{n}-brass.png",label+", brass") for n,label in zip(NAMES,names)],320),
      ("",[(f"waypost/{n}-plum.png",label+", plum") for n,label in zip(NAMES,names)],320),
      ("",[("checks/wayposts-64.png","Each pair: brass / plum; top 48 px, bottom 64 px")],300),
      ("5 Landmark Waypost",[("cracks/senado-lost-heavy.png","Senado vessel: heavy shared crack effect"),("screens/screen-landmark.png","Giant cracked fountain on invented map")],650),
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
    shapes();compositions();small_check();sheet()
